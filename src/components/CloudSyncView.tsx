import React, { useState } from 'react';
import { Cloud, Upload, Download, Copy, Check, Smartphone, Monitor, ShieldCheck, AlertCircle, FileText } from 'lucide-react';
import { saveManager } from '../game/saveManager';
import { UserSaveData } from '../game/types';
import { sound } from '../game/audioEngine';

interface CloudSyncViewProps {
  saveData: UserSaveData;
  onSaveUpdate: (updated: UserSaveData) => void;
}

export const CloudSyncView: React.FC<CloudSyncViewProps> = ({ saveData, onSaveUpdate }) => {
  const [cloudCode, setCloudCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleUploadCloud = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    const result = await saveManager.uploadToCloud(cloudCode || undefined);
    setIsSyncing(false);

    if (result.success && result.code) {
      setCloudCode(result.code);
      sound.playPickup();
      setSyncStatus({
        type: 'success',
        message: `Cloud save successfully synced! Your 6-character code is ${result.code}`
      });
    } else {
      setSyncStatus({
        type: 'error',
        message: result.error || 'Failed to sync to cloud storage'
      });
    }
  };

  const handleRestoreCloud = async () => {
    if (!inputCode.trim()) return;
    setIsSyncing(true);
    setSyncStatus(null);
    const result = await saveManager.restoreFromCloud(inputCode.trim());
    setIsSyncing(false);

    if (result.success && result.data) {
      onSaveUpdate(result.data);
      sound.playChargeRelease();
      setSyncStatus({
        type: 'success',
        message: `Save profile successfully restored! Welcome back, ${result.data.pilotName}.`
      });
    } else {
      setSyncStatus({
        type: 'error',
        message: result.error || 'Invalid sync code or cloud save not found'
      });
    }
  };

  const handleCopyCode = () => {
    if (!cloudCode) return;
    navigator.clipboard.writeText(cloudCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const jsonStr = saveManager.exportJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biohazard_save_${saveData.pilotName.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (saveManager.importJson(content)) {
        onSaveUpdate(saveManager.getData());
        sound.playChargeRelease();
        setSyncStatus({
          type: 'success',
          message: 'Local save imported successfully from file!'
        });
      } else {
        setSyncStatus({
          type: 'error',
          message: 'Invalid save file format.'
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="bg-[#090f18] border border-purple-500/40 rounded-lg p-5">
        <div className="flex items-center gap-2 text-xs font-arcade text-purple-400">
          <Cloud className="w-4 h-4" />
          <span>CROSS-PLATFORM ARCHIVE</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-arcade text-white mt-1">
          Cloud Save & Device Transfer
        </h1>
        <p className="text-xs text-slate-400 font-mono-tech mt-1 max-w-2xl leading-relaxed">
          Switch seamlessly between desktop PC, arcade controller rigs, and mobile phones.
          Your unlocked bio-vessels, genetic mutations, and high scores stay permanently synchronized.
        </p>

        {/* Sync Status Banner */}
        {syncStatus && (
          <div
            className={`mt-4 p-3 rounded text-xs font-mono-tech flex items-center gap-2 ${
              syncStatus.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
            }`}
          >
            {syncStatus.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload / Generate Code Box */}
        <div className="bg-[#080d15] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-arcade uppercase text-white font-bold">1. Upload to Cloud</h2>
            </div>
            <p className="text-xs text-slate-400 font-mono-tech mb-4 leading-relaxed">
              Upload your current local progress to generate a cross-device 6-character sync code.
            </p>

            {/* Current Stats Summary */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded mb-4 font-mono-tech text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Pilot Callsign:</span>
                <span className="text-white font-bold">{saveData.pilotName}</span>
              </div>
              <div className="flex justify-between">
                <span>Biomatter Reserves:</span>
                <span className="text-emerald-400 tabular-nums">{saveData.credits} BIO</span>
              </div>
              <div className="flex justify-between">
                <span>Vessels Unlocked:</span>
                <span className="text-sky-300">{saveData.unlockedShips.length} of 4</span>
              </div>
              <div className="flex justify-between">
                <span>Personal Best Score:</span>
                <span className="text-yellow-400 tabular-nums">{saveData.highScore}</span>
              </div>
            </div>

            {/* Generated Code Display */}
            {cloudCode && (
              <div className="p-3 bg-purple-950/40 border border-purple-500/50 rounded mb-4">
                <div className="text-[10px] text-purple-300 font-mono-tech uppercase mb-1">
                  Your 6-Character Sync Code:
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold font-arcade tracking-widest text-white">
                    {cloudCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 bg-purple-900/50 hover:bg-purple-800 rounded text-purple-200 transition-colors flex items-center gap-1 text-xs font-mono-tech"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleUploadCloud}
            disabled={isSyncing}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-arcade text-xs font-bold rounded shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Cloud className="w-4 h-4" />
            <span>{isSyncing ? 'Synchronizing...' : cloudCode ? 'Update Cloud Slot' : 'Sync & Generate Code'}</span>
          </button>
        </div>

        {/* Restore from Code Box */}
        <div className="bg-[#080d15] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-arcade uppercase text-white font-bold">2. Restore on Another Device</h2>
            </div>
            <p className="text-xs text-slate-400 font-mono-tech mb-4 leading-relaxed">
              Enter your 6-character sync code on your phone or laptop to instantly load your profile.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-mono-tech text-slate-400 mb-1">
                  ENTER 6-CHAR SYNC CODE (e.g. AVAR92):
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-lg font-arcade tracking-widest text-white uppercase placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-900/40 rounded border border-slate-800 text-[11px] font-mono-tech text-slate-400 flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  Tip: Test cross-device sync now using sample code <strong className="text-white">AVAR92</strong> to load an advanced pilot profile!
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRestoreCloud}
            disabled={isSyncing || !inputCode.trim()}
            className={`w-full py-2.5 font-arcade text-xs font-bold rounded transition-all flex items-center justify-center gap-2 ${
              inputCode.trim()
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>{isSyncing ? 'Restoring...' : 'Restore Save Profile'}</span>
          </button>
        </div>
      </div>

      {/* Offline JSON Backup */}
      <div className="bg-[#080d15] border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-tech text-xs">
        <div className="flex items-center gap-2.5 text-slate-400">
          <FileText className="w-4 h-4 text-slate-300" />
          <span>Manual Offline File Backup: Download or load raw JSON save state anytime.</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 transition-colors"
          >
            Export Save JSON
          </button>

          <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 transition-colors cursor-pointer">
            <span>Import Save JSON</span>
            <input 
              type="file" 
              accept=".json"
              onChange={handleImportJson}
              className="hidden" 
            />
          </label>
        </div>
      </div>
    </div>
  );
};
