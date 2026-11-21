import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');
const cl = (...a) => a.filter(Boolean).join(' ');

/* ─── Direction lookup matching Stitch floor plan ──────────── */
const BAY_DIRECTIONS = {
  'EV-01': 'Bay EV-01, Floor 2, first bay on left',
  'EV-02': 'Bay EV-02, Floor 2, second bay on left',
  'P-01': 'Bay P-01, Floor 2, straight ahead',
  'P-02': 'Bay P-02, Floor 2, turn left after entry',
  'P-03': 'Bay P-03, Floor 2, first bay on right',
  'P-04': 'Bay P-04, Floor 2, turn left after entry',
  'P-05': 'Bay P-05, Floor 2, third bay on right',
  'P-06': 'Bay P-06, Floor 2, far right corner',
  'B-01': 'Bay B-01, Floor 1, near ramp',
  'B-02': 'Bay B-02, Floor 1, second bay on left',
  'B-03': 'Bay B-03, Floor 1, first bay on right',
  'B-04': 'Bay B-04, Floor 1, far right',
  'B-05': 'Bay B-05, Floor 1, second bay from left',
  'B-06': 'Bay B-06, Floor 1, third bay from left',
  'B-07': 'Bay B-07, Floor 1, second bay from right',
  'B-08': 'Bay B-08, Floor 1, far right',
};

/* ─── Inline SVG atoms ─────────────────────────────────────── */
const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>
  </svg>
);
const IconCar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
  </svg>
);
const IconZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);
const IconBike = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/>
    <circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
  </svg>
);

/* ─── Rail icon button ─────────────────────────────────────── */
function RailBtn({ icon: Icon, active, label }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cl(
        'w-10 h-10 rounded-md flex items-center justify-center transition-colors',
        active
          ? 'bg-[#EFEEE9] text-[#1F5C4A]'
          : 'text-[#6B6A64] hover:bg-[#EFEEE9] hover:text-[#1A1A17]'
      )}
    >
      <Icon />
    </button>
  );
}

/* ─── Floor tab ───────────────────────────────────────────── */
function FloorTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cl(
        'px-4 py-1 rounded-sm text-sm font-medium transition-colors cursor-pointer',
        active
          ? 'bg-white text-[#1A1A17] shadow-sm'
          : 'text-[#6B6A64] hover:text-[#1A1A17]'
      )}
    >
      {label}
    </button>
  );
}

/* ─── Bay card ─────────────────────────────────────────────── */
function BayCard({ slot, fmt, onClick }) {
  const occ = Boolean(slot.occupiedBy);
  const isEv = slot.zone === 'EV_FAST_CHARGE';

  if (occ) {
    return (
      <button
        type="button"
        data-bay-id={slot.id}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e, slot);
        }}
        className="bay-tile text-left rounded-md bg-[#E4EFEA] border border-[#1F5C4A]/20 p-4 min-h-28 flex flex-col justify-between gap-2 transition-colors hover:border-[#1F5C4A] cursor-pointer"
      >
        <div className="flex items-center justify-between gap-1 w-full">
          <span className="font-mono text-xs text-[#6B6A64] tabular-nums">{slot.code}</span>
          {isEv && (
            <span className="text-[#B07A1F]">
              <IconZap />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm text-[#1F5C4A] font-medium tabular-nums truncate">
            {slot.occupiedBy.plate}
          </span>
          <span className="font-mono text-xs text-[#6B6A64] tabular-nums">
            {fmt(slot.occupiedBy.entryTime)}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      data-bay-id={slot.id}
      className="rounded-md bg-white border border-dashed border-[#D6D4CC] p-4 min-h-28 flex flex-col justify-between gap-2"
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <span className="font-mono text-xs text-[#6B6A64] tabular-nums">{slot.code}</span>
        {isEv && (
          <span className="text-[#B07A1F]">
            <IconZap />
          </span>
        )}
      </div>
      <span className="text-sm text-[#6B6A64]">Vacant</span>
    </div>
  );
}

/* ─── Bay popover ──────────────────────────────────────────── */
function BayPopover({ slot, now, onCheckout, pos }) {
  if (!slot || !slot.occupiedBy) return null;
  const mins = Math.max(1, Math.floor((now - slot.occupiedBy.entryTime) / 60000));
  const rate = slot.zone === 'BIKE' ? 20 : slot.zone === 'EV_FAST_CHARGE' ? 40 : 30;
  const fee = Math.ceil(mins / 60) * rate;
  const entryStr = new Date(slot.occupiedBy.entryTime).toTimeString().slice(0, 5);

  return (
    <div
      role="dialog"
      aria-label="Bay details"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-60 bg-white border border-[#D6D4CC] rounded-md shadow-lg p-4 flex flex-col gap-2 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[#6B6A64]">{slot.code}</span>
        <span className="font-mono text-xs text-[#6B6A64] tabular-nums">In {entryStr}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-[#1A1A17] tabular-nums font-semibold">{slot.occupiedBy.plate}</span>
        <span className="font-mono text-sm text-[#1F5C4A] tabular-nums font-semibold">₹{fee}</span>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        className="w-full mt-1 py-1 px-3 rounded-md bg-[#1F5C4A] hover:bg-[#174A3B] text-white text-sm font-medium transition-colors cursor-pointer"
      >
        Check out
      </button>
    </div>
  );
}

/* ─── Category segmented control ──────────────────────────── */
function CatTab({ label, Icon, active, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cl(
        'py-2 px-2 rounded-sm flex items-center justify-center gap-1.5 text-sm font-medium transition-colors cursor-pointer',
        active
          ? 'bg-white text-[#1A1A17] shadow-sm'
          : 'text-[#6B6A64] hover:text-[#1A1A17]'
      )}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}

/* ─── Activity timeline item ───────────────────────────────── */
function TimelineItem({ ev }) {
  const isExit = ev.status === 'EXITED';
  const isFull = ev.status === 'FULL';
  return (
    <li className="flex items-baseline justify-between gap-4">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs text-[#6B6A64] tabular-nums shrink-0">{ev.time}</span>
        <span className="font-mono text-sm text-[#1A1A17] tabular-nums font-semibold">{ev.plate}</span>
      </div>
      <span
        className={cl(
          'text-sm text-[#6B6A64] shrink-0 text-right',
          isExit && 'text-[#6B6A64]',
          isFull && 'text-[#B4443B]'
        )}
      >
        {ev.status === 'ALLOCATED' && ev.bay ? `Bay ${ev.bay}` : ev.message}
      </span>
    </li>
  );
}

/* ─────────────────────────── App ──────────────────────────── */
export default function App() {
  const [plaza, setPlaza] = useState(null);
  const [plateInput, setPlateInput] = useState('KA-01-MJ-4512');
  const [vehicleType, setVehicleType] = useState('STANDARD');
  const [gateStatus, setGateStatus] = useState({ state: 'IDLE' });
  const [now, setNow] = useState(Date.now());
  const [activeFloor, setActiveFloor] = useState(2);
  const [popoverState, setPopoverState] = useState(null); // { slotId, x, y }
  const [autoFillActive, setAutoFillActive] = useState(false);

  useEffect(() => {
    socket.on('plaza_state', (data) => setPlaza(data));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.off('plaza_state');
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setPopoverState(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Loading ── */
  if (!plaza) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center gap-3 text-[#6B6A64]">
        <div className="w-5 h-5 border-2 border-[#1F5C4A] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Connecting to gate controller…</span>
      </div>
    );
  }

  /* ── Helpers ── */
  const pickPlate = (type = vehicleType) => {
    const prefix = ['KA-01', 'KA-03', 'KA-05', 'KA-51'][Math.floor(Math.random() * 4)];
    const alpha =
      type === 'BIKE'
        ? ['TW', 'BK', 'RK', 'MN']
        : type === 'EV'
        ? ['EV', 'EL']
        : ['MJ', 'NB', 'HQ', 'CR'];
    const mid = alpha[Math.floor(Math.random() * alpha.length)];
    setPlateInput(`${prefix}-${mid}-${Math.floor(1000 + Math.random() * 8999)}`);
  };

  const handleTypeSelect = (t) => {
    setVehicleType(t);
    pickPlate(t);
  };

  const handleRegister = (e, joinWaitlist = false) => {
    if (e) e.preventDefault();
    if (!plateInput.trim()) return;
    setGateStatus({ state: 'SCANNING', plate: plateInput.toUpperCase() });
    socket.emit(
      'register_vehicle',
      { plate: plateInput, type: vehicleType, joinWaitlistIfFull: joinWaitlist },
      (res) => {
        setGateStatus(res);
        if (res.status === 'ALLOCATED') {
          setActiveFloor(res.slot.zone === 'BIKE' ? 1 : 2);
          pickPlate();
        } else if (res.status === 'WAITLISTED') {
          pickPlate();
        }
      }
    );
  };

  const fmt = (t) => {
    const s = Math.max(1, Math.floor((now - t) / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const handleBayClick = (e, slot) => {
    if (!slot.occupiedBy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 260);
    const y = Math.min(rect.bottom + 8, window.innerHeight - 150);
    setPopoverState((prev) => (prev?.slotId === slot.id ? null : { slotId: slot.id, x, y }));
  };

  const handleToggleAutoFill = () => {
    setAutoFillActive((prev) => !prev);
    socket.emit('simulate_traffic');
  };

  /* ── Derived calculations ── */
  const zc = plaza.zoneCounts || {
    fourWheelerFree: plaza.availableSlots,
    bikeFree: 0,
    totalFree: plaza.availableSlots,
  };
  const carBays = plaza.slots.filter((s) => s.zone !== 'BIKE');
  const bikeBays = plaza.slots.filter((s) => s.zone === 'BIKE');
  const floorBays = activeFloor === 2 ? carBays : bikeBays;
  const half = Math.ceil(floorBays.length / 2);
  const topRow = floorBays.slice(0, half);
  const bottomRow = floorBays.slice(half);
  const colsClass = activeFloor === 2 ? 'grid grid-cols-4 gap-4' : 'grid grid-cols-4 gap-4';

  const currentFloorTotal = activeFloor === 2 ? carBays.length : bikeBays.length;
  const currentFloorFree = activeFloor === 2 ? zc.fourWheelerFree : zc.bikeFree;
  const currentFloorOccupied = currentFloorTotal - currentFloorFree;
  const currentFloorPct = currentFloorTotal > 0 ? Math.round((currentFloorOccupied / currentFloorTotal) * 100) : 0;

  /* Guidance line text */
  const guidanceText = () => {
    if (gateStatus.state === 'ALLOCATED') {
      return (
        BAY_DIRECTIONS[gateStatus.slot?.code] ||
        `Bay ${gateStatus.slot?.code}, Floor ${gateStatus.slot?.floor}, turn left after entry`
      );
    }
    if (gateStatus.state === 'FULL') {
      return gateStatus.message || `No vacant ${vehicleType} bays available`;
    }
    if (gateStatus.state === 'WAITLISTED') {
      return `${gateStatus.plate} queued in waiting lane — auto-assigns on next exit`;
    }
    if (gateStatus.state === 'DUPLICATE') return gateStatus.message;
    if (gateStatus.state === 'SCANNING') return 'Scanning bay sensors…';
    return 'Bay P-02, Floor 2, turn left after entry';
  };

  const guidanceColor = () => {
    if (gateStatus.state === 'ALLOCATED') return 'text-[#1F5C4A]';
    if (gateStatus.state === 'FULL' || gateStatus.state === 'DUPLICATE') return 'text-[#B4443B]';
    return 'text-[#6B6A64]';
  };

  const clockStr = new Date(now).toTimeString().slice(0, 5) + ' IST';
  const activePopoverSlot = popoverState
    ? plaza.slots.find((s) => s.id === popoverState.slotId && s.occupiedBy)
    : null;

  return (
    <div
      className="min-h-screen flex bg-[#F5F4F0] text-[#1A1A17] antialiased selection:bg-[#E4EFEA] selection:text-[#1F5C4A]"
      style={{ fontFamily: '"Instrument Sans", sans-serif' }}
      onClick={() => setPopoverState(null)}
    >
      {/* ── SLIM LEFT RAIL (64px) ── */}
      <nav
        aria-label="Primary Navigation"
        className="w-16 shrink-0 bg-white border-r border-[#EAE9E4] flex flex-col items-center py-4 justify-between"
      >
        <div className="flex flex-col items-center gap-6">
          {/* Minimal Plaza Mark */}
          <div
            className="w-9 h-9 rounded-md bg-[#1F5C4A] text-white flex items-center justify-center font-mono text-sm font-semibold"
            aria-label="SmartPark OS"
          >
            P
          </div>
          {/* Rail Icons */}
          <div className="flex flex-col items-center gap-2">
            <RailBtn icon={IconGrid} label="Live Lot" active={true} />
          </div>
        </div>

        {/* Attendant Shift Indicator */}
        <div
          className="w-8 h-8 rounded-full bg-[#EFEEE9] flex items-center justify-center font-mono text-xs text-[#6B6A64]"
          title="Gate Booth 1"
        >
          G1
        </div>
      </nav>

      {/* ── MAIN WORKSPACE COLUMN ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Top Bar */}
        <header className="px-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-start gap-2.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1F5C4A] mt-2.5 shrink-0" aria-hidden="true" />
              <div className="flex flex-col">
                <h1 className="text-2xl font-semibold text-[#1A1A17] tracking-tight leading-tight">
                  Smart Parking System
                </h1>
                <span className="text-xs text-[#6B6A64] font-medium tracking-wide">
                  Indiranagar Plaza
                </span>
              </div>
            </div>
            <span className="font-mono text-xs text-[#6B6A64] tabular-nums mt-1">{clockStr}</span>
          </div>

          {/* Single Inline Occupancy Summary with 2px Progress Line (changes by active floor) */}
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-sm text-[#1A1A17] tabular-nums">
              {currentFloorFree} of {currentFloorTotal} free
            </span>
            <div className="w-40 h-0.5 bg-[#EAE9E4] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F5C4A] transition-all duration-150 origin-left"
                style={{ width: `${currentFloorPct}%` }}
              />
            </div>
          </div>
        </header>

        {/* Two-Column Main Area (~65% Lot Plan / ~35% Vehicle Arrival) */}
        <main className="flex-1 px-8 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ════ LEFT (~65%): Architectural Top-Down Lot Plan ════ */}
          <section
            className="lg:col-span-8 bg-white border border-[#EAE9E4] rounded-lg panel p-6 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#6B6A64] font-medium uppercase tracking-wider">
                  {activeFloor === 2 ? 'Floor 2 · Cars & EV' : 'Floor 1 · Bikes'}
                </span>
                <h2 className="text-base font-semibold text-[#1A1A17]">Lot plan</h2>
              </div>

              {/* Floor Switcher Segmented Control */}
              <div
                className="inline-flex items-center bg-[#EFEEE9] p-1 rounded-md gap-1"
                role="tablist"
                aria-label="Floor Switcher"
              >
                <FloorTab
                  label="Floor 2 · Cars & EV"
                  active={activeFloor === 2}
                  onClick={() => {
                    setActiveFloor(2);
                    setPopoverState(null);
                  }}
                />
                <FloorTab
                  label="Floor 1 · Bikes"
                  active={activeFloor === 1}
                  onClick={() => {
                    setActiveFloor(1);
                    setPopoverState(null);
                  }}
                />
              </div>
            </header>

            {/* Architectural Floor Plan Canvas */}
            <div className="relative flex flex-col gap-4 py-2">
              {/* Top Row of Bays */}
              <div className={colsClass}>
                {topRow.map((slot) => (
                  <BayCard key={slot.id} slot={slot} fmt={fmt} onClick={handleBayClick} />
                ))}
              </div>

              {/* Driving Lane with Entry Arrow & Dashed Center Line */}
              <div className="py-4 flex items-center gap-4">
                <div className="inline-flex items-center gap-1 text-[#6B6A64] shrink-0">
                  <span className="text-xs text-[#6B6A64] uppercase font-medium tracking-wide">Entry</span>
                  <IconArrowRight />
                </div>
                <div className="flex-1 border-t border-dashed border-[#D6D4CC]" />
                <span className="font-mono text-xs text-[#6B6A64] uppercase tracking-wider">Drive Aisle</span>
                <div className="flex-1 border-t border-dashed border-[#D6D4CC]" />
              </div>

              {/* Bottom Row of Bays */}
              <div className={colsClass}>
                {bottomRow.map((slot) => (
                  <BayCard key={slot.id} slot={slot} fmt={fmt} onClick={handleBayClick} />
                ))}
              </div>
            </div>

            {/* Quiet Legend & Shift Control */}
            <footer className="pt-2 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm bg-[#E4EFEA] border border-[#1F5C4A]/30"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-[#6B6A64]">Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm bg-white border border-dashed border-[#D6D4CC]"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-[#6B6A64]">Vacant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#B07A1F]">
                    <IconZap />
                  </span>
                  <span className="text-sm text-[#6B6A64]">EV Charging</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  socket.emit('reset_plaza');
                  setGateStatus({ state: 'IDLE' });
                  setPopoverState(null);
                }}
                className="text-xs font-medium text-[#6B6A64] hover:text-[#1A1A17] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Reset Shift
              </button>
            </footer>
          </section>

          {/* ════ RIGHT (~35%): Vehicle Arrival & Clean Timeline ════ */}
          <aside className="lg:col-span-4 bg-white border border-[#EAE9E4] rounded-lg panel p-6 flex flex-col gap-6">
            {/* Panel Header with Auto-Fill Toggle */}
            <header className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-[#1A1A17]">Vehicle arrival</h2>

              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B6A64]">Auto-fill</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoFillActive}
                  aria-label="Auto-fill sample vehicles"
                  onClick={handleToggleAutoFill}
                  className={cl(
                    'w-10 h-6 rounded-full p-1 flex items-center transition-colors cursor-pointer',
                    autoFillActive ? 'bg-[#1F5C4A]' : 'bg-[#EFEEE9]'
                  )}
                >
                  <span
                    className={cl(
                      'w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150',
                      autoFillActive ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            </header>

            {/* Realistic Indian HSRP Number Plate Input */}
            <form onSubmit={(e) => handleRegister(e, false)} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="plate-input"
                  className="text-xs text-[#6B6A64] font-medium uppercase tracking-wider"
                >
                  Registration Plate
                </label>
                <div className="flex items-stretch rounded-md border border-[#D6D4CC] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#1F5C4A] focus-within:ring-offset-2">
                  <div className="w-11 bg-[#1E3A8A] text-white flex flex-col items-center justify-center shrink-0 py-2 select-none">
                    <span className="font-mono text-xs leading-none">IND</span>
                  </div>
                  <input
                    id="plate-input"
                    type="text"
                    value={plateInput}
                    onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                    placeholder="KA-01-MJ-4512"
                    maxLength={15}
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    className="flex-1 bg-white border-0 px-4 py-3 font-mono text-lg font-semibold text-[#1A1A17] placeholder:text-[#6B6A64] focus:outline-none uppercase tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => pickPlate()}
                    aria-label="Generate sample plate"
                    title="Generate sample plate"
                    className="px-4 text-[#6B6A64] hover:text-[#1A1A17] transition-colors cursor-pointer"
                  >
                    <IconRefresh />
                  </button>
                </div>
              </div>

              {/* Car / EV / Bike Segmented Control */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-[#6B6A64] font-medium uppercase tracking-wider">Category</span>
                <div
                  className="grid grid-cols-3 gap-1 bg-[#EFEEE9] p-1 rounded-md"
                  role="radiogroup"
                  aria-label="Vehicle Category"
                >
                  <CatTab
                    label="Car"
                    Icon={IconCar}
                    active={vehicleType === 'STANDARD'}
                    onClick={() => handleTypeSelect('STANDARD')}
                  />
                  <CatTab
                    label="EV"
                    Icon={IconZap}
                    active={vehicleType === 'EV'}
                    onClick={() => handleTypeSelect('EV')}
                  />
                  <CatTab
                    label="Bike"
                    Icon={IconBike}
                    active={vehicleType === 'BIKE'}
                    onClick={() => handleTypeSelect('BIKE')}
                  />
                </div>
              </div>

              {/* Primary CTA & Quiet Guidance Line */}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={gateStatus.state === 'SCANNING'}
                  className="w-full py-2.5 px-4 rounded-md bg-[#1F5C4A] hover:bg-[#174A3B] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {gateStatus.state === 'SCANNING' ? 'Scanning sensors…' : 'Allocate space'}
                </button>
                <p className={cl('text-sm leading-snug', guidanceColor())}>{guidanceText()}</p>

                {gateStatus.state === 'FULL' && (
                  <button
                    type="button"
                    onClick={() => handleRegister(null, true)}
                    className="w-full mt-1 py-2 px-3 rounded-md border border-[#D6D4CC] hover:bg-[#EFEEE9] text-xs font-semibold text-[#1A1A17] transition-colors cursor-pointer"
                  >
                    Join Waiting Lane Instead
                  </button>
                )}
              </div>
            </form>

            {/* Waiting Queue List if any */}
            {plaza.waitQueue.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-[#EAE9E4]">
                <span className="text-xs text-[#6B6A64] font-medium uppercase tracking-wider">
                  Waiting Lane ({plaza.waitQueue.length})
                </span>
                <ul className="flex flex-col gap-1.5">
                  {plaza.waitQueue.map((w, idx) => (
                    <li key={w.plate} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#6B6A64] w-4">{idx + 1}.</span>
                        <span className="font-mono font-semibold text-[#1A1A17]">{w.plate}</span>
                      </div>
                      <span className="text-[#6B6A64]">{w.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clean Activity Timeline (No boxes, no dividers, only whitespace) */}
            <div className="pt-2 flex flex-col gap-4">
              <span className="text-xs text-[#6B6A64] font-medium uppercase tracking-wider">
                Recent activity
              </span>
              {plaza.recentEvents.length === 0 ? (
                <p className="text-sm text-[#6B6A64]">No events recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {plaza.recentEvents.slice(0, 6).map((ev) => (
                    <TimelineItem key={ev.id} ev={ev} />
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </main>
      </div>

      {/* Bay Detail Popover */}
      {activePopoverSlot && popoverState && (
        <BayPopover
          slot={activePopoverSlot}
          now={now}
          pos={{ x: popoverState.x, y: popoverState.y }}
          onCheckout={() => {
            socket.emit('checkout_slot', { slotId: activePopoverSlot.id });
            setPopoverState(null);
          }}
        />
      )}
    </div>
  );
}
