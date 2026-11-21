import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Car,
  Zap,
  Bike,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  RotateCcw,
  ScanLine,
  ArrowRight,
  Ticket,
  AlertTriangle,
  Users,
} from 'lucide-react';

const socket = io('http://localhost:5000');

export default function App() {
  const [plaza, setPlaza] = useState(null);
  const [plateInput, setPlateInput] = useState('KA-01-MJ-4512');
  const [vehicleType, setVehicleType] = useState('STANDARD');
  const [gateStatus, setGateStatus] = useState({ state: 'IDLE' });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    socket.on('plaza_state', (data) => setPlaza(data));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.off('plaza_state');
      clearInterval(timer);
    };
  }, []);

  if (!plaza) {
    return (
      <div className="min-h-screen bg-stone-100 text-stone-700 flex items-center justify-center font-medium">
        Initializing Gate Sensor Controller...
      </div>
    );
  }

  const pickRandomPlate = (typeOverride = vehicleType) => {
    const prefix = ['KA-01', 'KA-03', 'KA-05', 'KA-51'][Math.floor(Math.random() * 4)];
    const letters =
      typeOverride === 'BIKE'
        ? ['TW', 'BK', 'RK', 'MN']
        : typeOverride === 'EV'
        ? ['EV', 'EL']
        : ['MJ', 'NB', 'HQ', 'CR'];
    const mid = letters[Math.floor(Math.random() * letters.length)];
    const num = Math.floor(1000 + Math.random() * 8999);
    setPlateInput(`${prefix}-${mid}-${num}`);
  };

  const handleTypeSelect = (newType) => {
    setVehicleType(newType);
    pickRandomPlate(newType);
  };

  const handleRegister = (e, joinWaitlist = false) => {
    if (e) e.preventDefault();
    if (!plateInput.trim()) return;

    setGateStatus({ state: 'SCANNING', plate: plateInput.toUpperCase() });

    socket.emit(
      'register_vehicle',
      {
        plate: plateInput,
        type: vehicleType,
        joinWaitlistIfFull: joinWaitlist,
      },
      (response) => {
        setGateStatus(response);
        if (response.status === 'ALLOCATED' || response.status === 'WAITLISTED') {
          pickRandomPlate(vehicleType);
        }
      }
    );
  };

  const formatDuration = (entryTime) => {
    const sec = Math.max(1, Math.floor((now - entryTime) / 1000));
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return mins > 0 ? `${mins}m ${remSec}s` : `${remSec}s`;
  };

  const zc = plaza.zoneCounts || {
    evFree: 0,
    carFree: 0,
    bikeFree: 0,
    fourWheelerFree: plaza.availableSlots,
    totalFree: plaza.availableSlots,
  };
  const isAllFull = zc.totalFree === 0;

  const carBays = plaza.slots.filter((s) => s.zone !== 'BIKE');
  const bikeBays = plaza.slots.filter((s) => s.zone === 'BIKE');

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-black text-lg tracking-tighter">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900 leading-tight">
                Indiranagar Automated Parking Plaza
              </h1>
              <p className="text-xs text-stone-500">
                Separate Car &amp; Two-Wheeler Parking Bay Views
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-700">
              Car/EV Free: <span className="font-bold text-stone-900">{zc.fourWheelerFree}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800">
              Bike Free: <span className="font-bold">{zc.bikeFree}</span>
            </div>
            <div
              className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                isAllFull
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAllFull ? 'bg-red-600 animate-ping' : 'bg-emerald-600'
                }`}
              />
              {isAllFull ? 'PLAZA FULL' : `${zc.totalFree}/${plaza.totalSlots} OPEN`}
            </div>

            <button
              onClick={() => socket.emit('simulate_traffic')}
              className="px-3.5 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl border border-stone-200 transition cursor-pointer"
            >
              + Auto-Fill Sample Mix
            </button>

            <button
              onClick={() => {
                socket.emit('reset_plaza');
                setGateStatus({ state: 'IDLE' });
              }}
              className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl border border-stone-200 transition cursor-pointer"
              title="Clear All Bays"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-7 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* LEFT COLUMN: ENTRY GATE REGISTRATION + GATE BARRIER ACTIVITY LOG BELOW IT */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Step 1 • Vehicle Arrival
                </span>
                <h2 className="text-xl font-bold text-stone-900">Entry Gate Registration</h2>
              </div>
              <button
                type="button"
                onClick={() => pickRandomPlate(vehicleType)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                New Plate ↻
              </button>
            </div>

            <form onSubmit={(e) => handleRegister(e, false)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Vehicle Registration Number
                </label>
                <div className="flex items-center border-2 border-stone-300 focus-within:border-stone-900 rounded-xl overflow-hidden bg-amber-50/40">
                  <div className="bg-blue-700 text-white px-2.5 py-3 text-[10px] font-bold flex flex-col items-center justify-center leading-none">
                    <span>IND</span>
                  </div>
                  <input
                    type="text"
                    value={plateInput}
                    onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                    placeholder="KA-01-MJ-4512"
                    className="w-full px-3.5 py-2.5 text-lg font-mono font-bold tracking-widest text-stone-900 bg-transparent focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Vehicle Category
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'STANDARD', label: 'Standard Car', icon: Car },
                    { id: 'EV', label: 'EV Charge', icon: Zap },
                    { id: 'BIKE', label: 'Two-Wheeler', icon: Bike },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = vehicleType === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleTypeSelect(item.id)}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={gateStatus.state === 'SCANNING'}
                className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {gateStatus.state === 'SCANNING' ? (
                  <>
                    <ScanLine className="w-4 h-4 animate-pulse" />
                    Checking Bay Sensors...
                  </>
                ) : (
                  <>
                    Register &amp; Allocate Space <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-stone-100">
              {gateStatus.state === 'IDLE' && (
                <div className="text-center py-3 text-xs text-stone-400">
                  Select vehicle type and enter a plate above to check matching bay availability.
                </div>
              )}

              {gateStatus.state === 'SCANNING' && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3 text-blue-800">
                  <ScanLine className="w-5 h-5 animate-spin shrink-0" />
                  <div className="text-xs">
                    <div className="font-bold">Scanning Bay Sensors...</div>
                    <div>Checking matching space for {gateStatus.plate}</div>
                  </div>
                </div>
              )}

              {gateStatus.state === 'ALLOCATED' && (
                <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> SPACE AVAILABLE • GATE OPEN
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700">
                      {gateStatus.ticket.ticketId}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-stone-500">VEHICLE</div>
                      <div className="font-mono font-bold text-sm text-stone-900">
                        {gateStatus.ticket.plate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-stone-500">PROCEED TO</div>
                      <div className="text-xl font-black text-emerald-700">
                        {gateStatus.slot.code}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {gateStatus.state === 'FULL' && (
                <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 space-y-3">
                  <div className="flex items-start gap-2.5 text-red-800">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold">
                        {gateStatus.message || 'SPACE UNAVAILABLE — LOT FULL'}
                      </div>
                      <p className="text-xs text-red-700 mt-0.5">
                        No open matching bay for{' '}
                        <span className="font-mono font-bold">{gateStatus.plate}</span> right now.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegister(null, true)}
                    className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Join Waiting Lane Instead
                  </button>
                </div>
              )}

              {gateStatus.state === 'WAITLISTED' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-amber-900">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold">Queued in Entry Waiting Lane</div>
                    <p className="mt-0.5">
                      <span className="font-mono font-bold">{gateStatus.plate}</span> will be
                      automatically assigned the next matching bay that opens up.
                    </p>
                  </div>
                </div>
              )}

              {gateStatus.state === 'DUPLICATE' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {gateStatus.message}
                </div>
              )}
            </div>
          </div>

          {plaza.waitQueue.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                  <Users className="w-4 h-4" /> Entry Waiting Lane ({plaza.waitQueue.length})
                </div>
                <span className="text-[11px] text-amber-700">Auto-assigns on next exit</span>
              </div>
              <div className="space-y-2">
                {plaza.waitQueue.map((w, idx) => (
                  <div
                    key={w.plate}
                    className="bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-stone-900">{w.plate}</span>
                    </div>
                    <span className="text-stone-500 font-medium">{w.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gate Barrier Activity Log directly below Entry Gate Registration */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-stone-500" /> Gate Barrier Activity Log
              </h3>
              <span className="text-xs text-stone-400">Latest 30 events</span>
            </div>

            <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
              {plaza.recentEvents.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  No gate movements recorded yet.
                </div>
              ) : (
                plaza.recentEvents.map((ev) => (
                  <div key={ev.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-stone-400 shrink-0">{ev.time}</span>
                      <span className="font-mono font-bold text-stone-800 shrink-0">{ev.plate}</span>
                      <span className="text-stone-600 truncate">{ev.message}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        ev.status === 'ALLOCATED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ev.status === 'FULL'
                          ? 'bg-red-100 text-red-700'
                          : ev.status === 'WAITLIST'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TWO SEPARATE PARKING BAY VIEWS (1. CARS & EV, 2. BIKES BELOW) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Separate View 1: Car & EV Parking Bays */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Car &amp; EV Parking Bays</h2>
                <p className="text-xs text-stone-500">
                  Standard Cars &amp; EV Charging ({zc.fourWheelerFree} of {carBays.length} free)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-stone-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Open
                </span>
                <span className="flex items-center gap-1.5 text-stone-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-stone-800" /> Occupied
                </span>
              </div>
            </div>

            <div className="bg-stone-800 rounded-2xl p-4 border-4 border-stone-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {carBays.map((slot) => (
                  <ParkingBayCard
                    key={slot.id}
                    slot={slot}
                    formatDuration={formatDuration}
                    onCheckout={() => socket.emit('checkout_slot', { slotId: slot.id })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Separate View 2: Bike Parking Bays (Below Cars) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Bike Parking Bays</h2>
                <p className="text-xs text-stone-500">
                  Dedicated Two-Wheeler Bays ({zc.bikeFree} of {bikeBays.length} free)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold">
                Two-Wheelers Only
              </span>
            </div>

            <div className="bg-stone-800 rounded-2xl p-4 border-4 border-stone-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {bikeBays.map((slot) => (
                  <ParkingBayCard
                    key={slot.id}
                    slot={slot}
                    formatDuration={formatDuration}
                    onCheckout={() => socket.emit('checkout_slot', { slotId: slot.id })}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ParkingBayCard({ slot, formatDuration, onCheckout }) {
  const occupied = Boolean(slot.occupiedBy);
  const isEv = slot.zone === 'EV_FAST_CHARGE';
  const isBike = slot.zone === 'BIKE';

  return (
    <div
      className={`rounded-xl p-3 border-2 transition-all flex flex-col justify-between min-h-[144px] ${
        occupied
          ? 'bg-stone-900 border-amber-400/80 text-white'
          : isBike
          ? 'bg-sky-950/40 border-dashed border-sky-500/60 text-sky-100'
          : 'bg-stone-700/60 border-dashed border-stone-500 text-stone-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black tracking-wider">{slot.code}</span>
        {isEv && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
            EV
          </span>
        )}
        {isBike && (
          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">
            BIKE
          </span>
        )}
      </div>

      {occupied ? (
        <div className="my-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-300">
            {slot.occupiedBy.type === 'BIKE' ? (
              <Bike className="w-4 h-4 shrink-0" />
            ) : (
              <Car className="w-4 h-4 shrink-0" />
            )}
            <span className="font-mono text-[11px] font-bold truncate">
              {slot.occupiedBy.plate}
            </span>
          </div>
          <div className="text-[10px] text-stone-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Parked {formatDuration(slot.occupiedBy.entryTime)}
          </div>
        </div>
      ) : (
        <div className="my-auto text-center">
          <span className="inline-block px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wide">
            VACANT
          </span>
        </div>
      )}

      {occupied ? (
        <button
          onClick={onCheckout}
          className="w-full py-1.5 px-2 rounded-lg bg-stone-800 hover:bg-red-600 text-stone-200 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
        >
          <LogOut className="w-3 h-3" /> Checkout
        </button>
      ) : (
        <div className="text-[10px] text-center text-stone-400">Sensor Ready</div>
      )}
    </div>
  );
}