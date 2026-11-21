const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

class CountingSemaphore {
  constructor(initialCount) {
    this.count = initialCount;
    this.waitQueue = [];
  }

  tryAcquire() {
    if (this.count > 0) {
      this.count--;
      return true;
    }
    return false;
  }

  wait(vehicle, resolve) {
    this.waitQueue.push({ vehicle, resolve });
  }

  signal() {
    if (this.waitQueue.length > 0) {
      const now = Date.now();
      this.waitQueue.forEach((item) => {
        const waitSec = (now - item.vehicle.enqueuedAt) / 1000;
        item.vehicle.effectivePriority =
          item.vehicle.basePriority + Math.floor(waitSec / 5);
      });
      this.waitQueue.sort(
        (a, b) => b.vehicle.effectivePriority - a.vehicle.effectivePriority
      );
      const next = this.waitQueue.shift();
      next.resolve();
    } else {
      this.count++;
    }
  }
}

class MutexLock {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async lock() {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}

const BIKE_SLOTS = 8;
const EV_SLOTS = 2;
const CAR_SLOTS = 6;
const TOTAL_SLOTS = BIKE_SLOTS + EV_SLOTS + CAR_SLOTS;

function createSlots() {
  const list = [];
  // Floor 1: Two-Wheeler Bike Zone (B-01 .. B-08)
  for (let i = 0; i < BIKE_SLOTS; i++) {
    list.push({
      id: list.length + 1,
      code: `B-0${i + 1}`,
      floor: 1,
      zone: 'BIKE',
      occupiedBy: null,
    });
  }
  // Floor 2: EV Charging (EV-01 .. EV-02) + Standard Cars (P-01 .. P-06)
  for (let i = 0; i < EV_SLOTS; i++) {
    list.push({
      id: list.length + 1,
      code: `EV-0${i + 1}`,
      floor: 2,
      zone: 'EV_FAST_CHARGE',
      occupiedBy: null,
    });
  }
  for (let i = 0; i < CAR_SLOTS; i++) {
    list.push({
      id: list.length + 1,
      code: `P-0${i + 1}`,
      floor: 2,
      zone: 'STANDARD',
      occupiedBy: null,
    });
  }
  return list;
}

let slots = createSlots();
let bikeSemaphore = new CountingSemaphore(BIKE_SLOTS);
let carPoolSemaphore = new CountingSemaphore(EV_SLOTS + CAR_SLOTS);
let allocationMutex = new MutexLock();

let waitQueue = [];
let recentEvents = [];

function addEvent(status, plate, message, bay = null) {
  recentEvents = [
    {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      status,
      plate,
      message,
      bay,
    },
    ...recentEvents.slice(0, 29),
  ];
}

function getZoneCounts() {
  const evFree = slots.filter((s) => s.zone === 'EV_FAST_CHARGE' && !s.occupiedBy).length;
  const carFree = slots.filter((s) => s.zone === 'STANDARD' && !s.occupiedBy).length;
  const bikeFree = slots.filter((s) => s.zone === 'BIKE' && !s.occupiedBy).length;
  return {
    evFree,
    carFree,
    bikeFree,
    fourWheelerFree: evFree + carFree,
    totalFree: evFree + carFree + bikeFree,
  };
}

function broadcastState() {
  const counts = getZoneCounts();
  io.emit('plaza_state', {
    totalSlots: TOTAL_SLOTS,
    availableSlots: counts.totalFree,
    zoneCounts: counts,
    slots,
    waitQueue,
    recentEvents,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findMatchingSlot(type) {
  if (type === 'BIKE') {
    return slots.find((s) => !s.occupiedBy && s.zone === 'BIKE');
  }
  if (type === 'EV') {
    return (
      slots.find((s) => !s.occupiedBy && s.zone === 'EV_FAST_CHARGE') ||
      slots.find((s) => !s.occupiedBy && s.zone === 'STANDARD')
    );
  }
  return slots.find((s) => !s.occupiedBy && s.zone === 'STANDARD');
}

function getSemaphoreForType(type) {
  return type === 'BIKE' ? bikeSemaphore : carPoolSemaphore;
}

async function allocateBayToVehicle({ plate, type, autoCheckoutMs = null }) {
  await allocationMutex.lock();

  const targetSlot = findMatchingSlot(type);

  if (targetSlot) {
    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
    targetSlot.occupiedBy = {
      plate,
      type,
      entryTime: Date.now(),
      ticketId,
    };
    addEvent(
      'ALLOCATED',
      plate,
      `Assigned to ${targetSlot.code} (Floor ${targetSlot.floor})`,
      targetSlot.code
    );
    allocationMutex.unlock();
    broadcastState();

    if (autoCheckoutMs) {
      setTimeout(() => checkoutBySlotId(targetSlot.id), autoCheckoutMs);
    }
    return { status: 'ALLOCATED', slot: targetSlot, ticket: targetSlot.occupiedBy };
  }

  allocationMutex.unlock();
  return { status: 'FULL' };
}

async function checkoutBySlotId(slotId) {
  await allocationMutex.lock();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !slot.occupiedBy) {
    allocationMutex.unlock();
    return;
  }

  const departing = slot.occupiedBy;
  slot.occupiedBy = null;
  addEvent('EXITED', departing.plate, `Checked out from ${slot.code}`, slot.code);
  allocationMutex.unlock();

  getSemaphoreForType(departing.type).signal();
  broadcastState();
}

io.on('connection', (socket) => {
  broadcastState();

  socket.on('register_vehicle', async (payload, callback) => {
    const plate = (payload?.plate || '').trim().toUpperCase();
    const rawType = payload?.type;
    const type = rawType === 'EV' ? 'EV' : rawType === 'BIKE' ? 'BIKE' : 'STANDARD';
    const joinWaitlistIfFull = Boolean(payload?.joinWaitlistIfFull);

    if (!plate) {
      if (callback) callback({ status: 'ERROR', message: 'Enter a valid vehicle number.' });
      return;
    }

    const alreadyParked = slots.some((s) => s.occupiedBy?.plate === plate);
    const alreadyWaiting = waitQueue.some((w) => w.plate === plate);
    if (alreadyParked || alreadyWaiting) {
      if (callback) {
        callback({ status: 'DUPLICATE', message: `${plate} is already inside or in queue.` });
      }
      return;
    }

    await sleep(650);

    const sem = getSemaphoreForType(type);
    const hasMatchingBay = Boolean(findMatchingSlot(type));

    if (hasMatchingBay && sem.tryAcquire()) {
      const result = await allocateBayToVehicle({ plate, type });
      if (callback) callback(result);
    } else if (joinWaitlistIfFull) {
      const basePriority = type === 'EV' ? 5 : type === 'BIKE' ? 3 : 1;
      const entry = {
        plate,
        type,
        basePriority,
        effectivePriority: basePriority,
        enqueuedAt: Date.now(),
      };
      waitQueue.push(entry);
      addEvent('WAITLIST', plate, `No ${type} Bay Free — Added to Waiting Lane`);
      broadcastState();

      if (callback) callback({ status: 'WAITLISTED', plate });

      while (!findMatchingSlot(type)) {
        await new Promise((resolve) => sem.wait(entry, resolve));
      }

      sem.tryAcquire();
      waitQueue = waitQueue.filter((w) => w.plate !== plate);
      await allocateBayToVehicle({ plate, type });
    } else {
      const fullMsg =
        type === 'BIKE'
          ? 'Floor 1 Bike Bays Full (B-01..B-08)'
          : type === 'STANDARD'
          ? 'Floor 2 Standard Car Bays Full'
          : 'Floor 2 Car/EV Bays Full';
      addEvent('FULL', plate, fullMsg);
      broadcastState();
      if (callback) callback({ status: 'FULL', plate, message: fullMsg });
    }
  });

  socket.on('checkout_slot', ({ slotId }) => {
    checkoutBySlotId(slotId);
  });

  socket.on('simulate_traffic', async () => {
    const samplePlates = [
      { plate: 'KA-01-TW-5521', type: 'BIKE' },
      { plate: 'KA-05-EV-8810', type: 'EV' },
      { plate: 'KA-01-MJ-2041', type: 'STANDARD' },
      { plate: 'KA-03-HQ-1192', type: 'STANDARD' },
    ];
    for (const car of samplePlates) {
      const sem = getSemaphoreForType(car.type);
      const matching = findMatchingSlot(car.type);
      if (matching && sem.tryAcquire()) {
        await allocateBayToVehicle({ ...car, autoCheckoutMs: 14000 });
      }
      await sleep(250);
    }
  });

  socket.on('reset_plaza', () => {
    slots = createSlots();
    bikeSemaphore = new CountingSemaphore(BIKE_SLOTS);
    carPoolSemaphore = new CountingSemaphore(EV_SLOTS + CAR_SLOTS);
    allocationMutex = new MutexLock();
    waitQueue = [];
    recentEvents = [];
    broadcastState();
  });
});

server.listen(5000, () => {
  console.log('SmartPark Gate Controller running on http://localhost:5000');
});