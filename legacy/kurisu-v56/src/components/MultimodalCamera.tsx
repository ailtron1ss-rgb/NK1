/**
 * Multimodal Camera & Vision Perception Component.
 * Enables Kurisu to see the world through the device camera lens or uploaded photos,
 * processing images through Gemini 3.6 Flash multimodal vision.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, Eye, Sparkles } from 'lucide-react';

interface MultimodalCameraProps {
  onAnalyzeImage: (base64: string, prompt: string) => void;
  isLoading: boolean;
}

export const MultimodalCamera: React.FC<MultimodalCameraProps> = ({ onAnalyzeImage, isLoading }) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (e) {
      alert('Не удалось получить доступ к камере. Проверьте разрешения.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendToKurisu = () => {
    if (!capturedImage) return;
    onAnalyzeImage(capturedImage, customPrompt || 'Посмотри на этот объект и прокомментируй его.');
  };

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-5 text-slate-100 shadow-2xl backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#FF3B30]" />
            Мультимодальное Визуальное Восприятие
          </h3>
          <p className="text-xs text-white/70 mt-0.5">Оптический анализ через камеру и фотосъемку</p>
        </div>

        {!isCameraActive ? (
          <button
            onClick={startCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white text-xs font-mono rounded-lg shadow-[0_0_12px_rgba(255,59,48,0.4)] transition-all active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" />
            Включить Камеру
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-mono rounded-lg border border-white/10"
          >
            Выключить
          </button>
        )}
      </div>

      {/* Viewport Area */}
      <div className="relative w-full aspect-video bg-[#050508] rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
        {isCameraActive && (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}

        {!isCameraActive && capturedImage && (
          <img src={capturedImage} alt="Снимок" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        )}

        {!isCameraActive && !capturedImage && (
          <div className="text-center p-6 text-white/40 text-xs font-mono flex flex-col items-center gap-2">
            <Eye className="w-8 h-8 text-[#FF3B30] animate-pulse" />
            <span>Оптический сенсор выключен. Включите камеру или загрузите фото.</span>
          </div>
        )}

        {/* Action Overlay */}
        {isCameraActive && (
          <button
            onClick={takeSnapshot}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white p-3 rounded-full shadow-[0_0_20px_#FF3B30] transition-all active:scale-90 border-2 border-white/50"
            title="Сделать снимок"
          >
            <Camera className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Controls & Prompt */}
      {capturedImage && (
        <div className="space-y-3 pt-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Вопрос к Курису по снимку (например: Что ты видишь на этом фото?)"
            className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-[#FF3B30] font-sans"
          />

          <div className="flex items-center justify-between">
            <label className="cursor-pointer text-xs text-white/60 hover:text-white flex items-center gap-1.5 font-mono">
              <ImageIcon className="w-3.5 h-3.5 text-white/60" />
              Загрузить другое фото
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handleSendToKurisu}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] hover:bg-[#FF3B30]/90 disabled:opacity-50 text-white text-xs font-mono rounded-xl shadow-[0_0_12px_rgba(255,59,48,0.4)] transition-all active:scale-95"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Отправить Курису на анализ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
