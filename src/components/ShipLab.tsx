import React, { useEffect, useRef, useState } from 'react';
import { Shield, Zap, Wind, Crosshair, Dna, Check, Lock, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';
import { rankFromXp } from '../game/ranks';
import { INITIAL_SHIPS, PlayerMutations, ShipDef, UserSaveData } from '../game/types';
import { sound } from '../game/audioEngine';
import { drawBioShip } from '../game/shipSprites';

interface ShipLabProps {
  saveData: UserSaveData;
  onSaveUpdate: (updated: UserSaveData) => void;
  onDeploy: () => void;
  /** Shown between crucible sectors. The button continues the run. */
  notice?: string;
  deployLabel?: string;
  /** Called instead of stopping music when the lab closes back into a run. */
  onExit?: () => void;
}

const ShipPreviewCanvas: React.FC<{ ship: ShipDef }> = ({ ship }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = Date.now() * 0.006;
      const px = canvas.width / 2;
      const py = canvas.height / 2;

      ctx.save();
      ctx.translate(px, py);
      drawBioShip(ctx, ship.id, t);

      // Weapon pod orbiting
      const podX = Math.cos(t * 3) * 38;
      const podY = Math.sin(t * 3) * 38;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(podX, podY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [ship]);

  return (
    <canvas 
      ref={canvasRef} 
      width={140} 
      height={90} 
      className="pixel-art bg-slate-950/90 rounded border border-slate-700/80 shadow-md"
    />
  );
};

export const ShipLab: React.FC<ShipLabProps> = ({
  saveData,
  onSaveUpdate,
  onDeploy,
  notice,
  deployLabel = 'Deploy Active Craft',
  onExit
}) => {
  const [selectedShipId, setSelectedShipId] = useState<string>(saveData.activeShipId);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    sound.playBgm('lab');
    return () => {
      const exit = onExitRef.current;
      if (exit) exit();
      else sound.stopBgm();
    };
  }, []);

  const selectedShip = INITIAL_SHIPS.find(s => s.id === selectedShipId) || INITIAL_SHIPS[0];
  const standing = rankFromXp(saveData.pilotXp);
  const isUnlocked = saveData.unlockedShips.includes(selectedShip.id);

  const handleSelectShip = (id: string) => {
    setSelectedShipId(id);
    onSaveUpdate({ ...saveData, activeShipId: id });
    sound.playShipEquip();
  };

  const handleUnlockShip = (ship: ShipDef) => {
    if (saveData.credits < ship.cost) return;
    sound.playUpgradeSuccess();
    onSaveUpdate({
      ...saveData,
      credits: saveData.credits - ship.cost,
      unlockedShips: [...saveData.unlockedShips, ship.id],
      activeShipId: ship.id
    });
  };

  const handleUpgradeMutation = (key: keyof PlayerMutations, cost: number) => {
    if (saveData.credits < cost) return;
    const currentVal = saveData.mutations[key];
    if (currentVal >= 5) return;

    sound.playUpgradeSuccess();
    onSaveUpdate({
      ...saveData,
      credits: saveData.credits - cost,
      mutations: {
        ...saveData.mutations,
        [key]: currentVal + 1
      }
    });
  };

  const mutationDefs: Array<{
    key: keyof PlayerMutations;
    name: string;
    description: string;
    icon: React.ReactNode;
    baseCost: number;
    color: string;
  }> = [
    {
      key: 'chitinArmor',
      name: 'Chitin Carapace Plating',
      description: '+25 Max Bio-Hull Shielding per tier',
      icon: <Shield className="w-4 h-4 text-emerald-400" />,
      baseCost: 50,
      color: '#10b981'
    },
    {
      key: 'synapticReflex',
      name: 'Synaptic Booster Genes',
      description: '+15% Thruster agility and directional acceleration',
      icon: <Wind className="w-4 h-4 text-sky-400" />,
      baseCost: 40,
      color: '#38bdf8'
    },
    {
      key: 'podOverclock',
      name: 'Pod Resonance Overclock',
      description: '+20% Weapon Pod damage and bullet absorption radius',
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      baseCost: 60,
      color: '#a855f7'
    },
    {
      key: 'plasmaPiercing',
      name: 'Corrosive Plasma Infusion',
      description: '+4 Primary Blaster damage with piercing penetration',
      icon: <Crosshair className="w-4 h-4 text-amber-400" />,
      baseCost: 75,
      color: '#f59e0b'
    },
    {
      key: 'sporeLeech',
      name: 'Mutagenic Spore Leech',
      description: '+12% Biomatter drop harvest rate from eliminated biomorphs',
      icon: <Dna className="w-4 h-4 text-rose-400" />,
      baseCost: 50,
      color: '#f43f5e'
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Header Banner & Biomatter Count */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0a111a] border border-slate-800 rounded-lg p-4">
        <div>
          <div className="text-xs text-sky-400 font-arcade uppercase tracking-wider">Genetic Mutation Laboratory</div>
          <h1 className="text-xl sm:text-2xl font-bold text-white font-arcade mt-0.5">Avaron Bio-Vessels</h1>
          <p className="text-xs text-slate-400 font-mono-tech mt-1">
            Re-engineer biomechanical starfighters using harvested planetary biomatter.
            {' '}RK {standing.rank} {standing.title}
            {standing.damageBonus > 0 ? ` · +${Math.round(standing.damageBonus * 100)}% weapon damage.` : ' · clear sectors to rank up.'}
          </p>
          {notice && (
            <p className="mt-2 text-[11px] font-mono-tech text-emerald-300 max-w-xl">{notice}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-emerald-950/60 border border-emerald-500/50 rounded flex items-center gap-2 font-mono-tech">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-right">
              <div className="text-[10px] text-emerald-400/80 uppercase">Available Biomatter</div>
              <div className="text-lg font-bold text-emerald-300 tabular-nums">{saveData.credits} BIO</div>
            </div>
          </div>

          <button
            onClick={onDeploy}
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-arcade text-xs font-bold rounded shadow-lg shadow-sky-500/20 active:scale-95 transition-all whitespace-nowrap"
          >
            {deployLabel}
          </button>
        </div>
      </div>

      {/* Lab Pixel Art Illustration */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] rounded-lg overflow-hidden border border-slate-800">
        <img 
          src="/src/assets/images/biohazard_ships_lab_1791942723444.jpg" 
          alt="Bio-Hazard Ship Mutation Lab"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover pixel-art"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a111a] via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-2 left-4 text-xs font-mono-tech text-slate-300">
          BIO-CHAMBER: ACTIVE MUTATION VATS · BIO-VESSELS 01 - 04
        </div>
      </div>

      {/* Ships Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {INITIAL_SHIPS.map((ship) => {
          const unlocked = saveData.unlockedShips.includes(ship.id);
          const active = saveData.activeShipId === ship.id;
          const isSelected = selectedShipId === ship.id;

          return (
            <div
              key={ship.id}
              onClick={() => handleSelectShip(ship.id)}
              className={`cursor-pointer rounded-lg p-3.5 border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900/90 border-sky-400 shadow-lg shadow-sky-950/40'
                  : 'bg-[#080d15] border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-arcade text-slate-400">{ship.alias}</span>
                  {active ? (
                    <span className="text-[9px] font-arcade text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-500/40">
                      DEPLOYED
                    </span>
                  ) : unlocked ? (
                    <span className="text-[9px] font-arcade text-emerald-400">UNLOCKED</span>
                  ) : (
                    <span className="text-[9px] font-mono-tech text-amber-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {ship.cost} BIO
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center font-arcade text-xs font-bold"
                    style={{ backgroundColor: `${ship.color}25`, color: ship.color }}
                  >
                    {ship.name.charAt(0)}
                  </div>
                  <h3 className="font-arcade text-xs font-bold text-white">{ship.name}</h3>
                </div>

                <p className="text-[11px] text-slate-400 font-mono-tech line-clamp-2 leading-relaxed mb-3">
                  {ship.description}
                </p>
              </div>

              {/* Stat Meters */}
              <div className="space-y-1.5 font-mono-tech text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>Speed:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <span key={v} className={`w-2.5 h-1.5 rounded-xs ${v <= ship.speed ? 'bg-sky-400' : 'bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Armor:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <span key={v} className={`w-2.5 h-1.5 rounded-xs ${v <= ship.armor ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Firepower:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <span key={v} className={`w-2.5 h-1.5 rounded-xs ${v <= ship.firePower ? 'bg-amber-400' : 'bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Instant Equip Button on Every Card */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectShip(ship.id);
                }}
                className={`w-full mt-3 py-1.5 rounded font-arcade text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  active
                    ? 'bg-sky-400 text-slate-950 shadow-md shadow-sky-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {active ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                    <span>EQUIPPED</span>
                  </>
                ) : (
                  <span>EQUIP CRAFT</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected Ship Detail & Live Biomechanical Preview */}
      <div className="bg-[#080d15] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 pb-5 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Live Animated Canvas Preview of Selected Craft */}
            <ShipPreviewCanvas ship={selectedShip} />

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-arcade font-bold text-white">{selectedShip.name}</h2>
                <span className="text-xs font-mono-tech text-sky-400">({selectedShip.type})</span>
              </div>
              <p className="text-xs text-slate-400 font-mono-tech mt-1 max-w-xl leading-relaxed">
                {selectedShip.lore}
              </p>
              <div className="mt-2 text-[11px] font-mono-tech text-amber-300">
                Signature Weapon: <strong className="text-white">{selectedShip.specialWeapon}</strong> · Pod Type: <span className="uppercase text-purple-300">{selectedShip.podType}</span>
              </div>
            </div>
          </div>

          <div>
            {saveData.activeShipId !== selectedShip.id ? (
              <button
                onClick={() => handleSelectShip(selectedShip.id)}
                className="px-6 py-2.5 bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-950 font-arcade text-xs font-bold rounded shadow-lg shadow-sky-500/30 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Equip {selectedShip.name}</span>
              </button>
            ) : (
              <div className="px-5 py-2 bg-emerald-950/60 border border-emerald-500/50 rounded text-emerald-300 font-arcade text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Ready for Deployment</span>
              </div>
            )}
          </div>
        </div>

        {/* Genetic Mutations Tree */}
        <div className="mt-5">
          <h3 className="text-xs font-arcade uppercase text-slate-300 mb-3 flex items-center gap-2">
            <Dna className="w-4 h-4 text-sky-400" />
            <span>Genome Enhancements</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mutationDefs.map((m) => {
              const currentTier = saveData.mutations[m.key];
              const cost = m.baseCost * (currentTier + 1);
              const isMax = currentTier >= 5;
              const canBuy = saveData.credits >= cost && !isMax;

              return (
                <div
                  key={m.key}
                  className="p-3 bg-slate-900/60 border border-slate-800 rounded flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {m.icon}
                        <span className="font-arcade text-[11px] text-white font-bold">{m.name}</span>
                      </div>
                      <span className="text-[10px] font-mono-tech text-sky-400">
                        Tier {currentTier}/5
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono-tech mb-2">
                      {m.description}
                    </p>

                    {/* Tier pips */}
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((tier) => (
                        <div
                          key={tier}
                          className={`flex-1 h-1.5 rounded-xs ${
                            tier <= currentTier ? 'bg-sky-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpgradeMutation(m.key, cost)}
                    disabled={!canBuy}
                    className={`w-full py-1.5 rounded text-[11px] font-mono-tech font-bold transition-all ${
                      isMax
                        ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                        : canBuy
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'MAX TIER REACHED' : `Upgrade (${cost} BIO)`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
