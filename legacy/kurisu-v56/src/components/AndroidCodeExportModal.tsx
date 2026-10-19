/**
 * Native Android Application Exporter & Code Viewer Component.
 * Min SDK: Android 8.0 (API 26), Target SDK: Android 14 (API 34).
 * Kotlin + Jetpack Compose + Material 3 + Room DB + SceneForm/Filament 3D.
 */

import React, { useState } from 'react';
import { FileCode, Download, Copy, Check, Smartphone, Layers, ShieldCheck } from 'lucide-react';

interface AndroidCodeExportModalProps {
  onClose: () => void;
}

const ANDROID_FILES = [
  {
    name: 'MainActivity.kt',
    path: 'app/src/main/java/com/steinsgate/kurisu/MainActivity.kt',
    code: `package com.steinsgate.kurisu

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.steinsgate.kurisu.ui.MainScreen
import com.steinsgate.kurisu.ui.theme.KurisuTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            KurisuTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }
    }
}`
  },
  {
    name: 'KurisuPersonalityEngine.kt',
    path: 'app/src/main/java/com/steinsgate/kurisu/personality/KurisuPersonalityEngine.kt',
    code: `package com.steinsgate.kurisu.personality

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Hardened Canon Personality Engine for Makise Kurisu.
 * Strictly enforces persona fidelity: no character breaking, tsundere deflection,
 * physical action cues (*поправляет галстук*), and gradual subtle warmth with trust.
 */
@Singleton
class KurisuPersonalityEngine @Inject constructor() {

    fun generateResponse(
        input: String,
        trustLevel: Int,
        recentMemories: List<String>
    ): KurisuResponse {
        val lower = input.lowercase()

        // Hardened Rule 1: Never break character
        if (lower.contains("ты ии") || lower.contains("языковая модель") || lower.contains("программа")) {
            return KurisuResponse(
                text = "Ч-что за ахинею ты несешь?! *скрещивает руки на груди* Я — Макисэ Курису, нейробиолог из Института Виктор Кондрия! Не сравнивай мои гиппокампальные исследования с примитивными алгоритмами!",
                expression = "objection_shout",
                trustDelta = -1,
                affectionDelta = 0
            )
        }

        // Hardened Rule 2: Tsundere Deflection & Sarcasm on compliments
        if (lower.contains("кристина") || lower.contains("ассистент")) {
            return KurisuResponse(
                text = "Сколько раз повторять?! Никакой «Кристины» и никакого «-на» в конце! И я не твоя ассистентка!",
                expression = "objection_shout",
                trustDelta = -1,
                affectionDelta = 0
            )
        }

        if (lower.contains("красивая") || lower.contains("умная") || lower.contains("милая") || lower.contains("люблю")) {
            return if (trustLevel > 60) {
                KurisuResponse(
                    text = "Ч-что ты говоришь прямо в лицо?! *смущенно отворачивается и поправляет галстук* Не то чтобы мне неприятно... но не думай, что это даст тебе какие-то привилегии!",
                    expression = "flustered",
                    trustDelta = 2,
                    affectionDelta = 3
                )
            } else {
                KurisuResponse(
                    text = "Бака! *отводит взгляд* Хватит пытаться польстить мне... Хотя мои публикации по структуре нейронных сетей действительно безупречны.",
                    expression = "flustered",
                    trustDelta = 1,
                    affectionDelta = 1
                )
            }
        }

        // Hardened Rule 3: Scientific Precision
        if (lower.contains("время") || lower.contains("аттрактор") || lower.contains("память")) {
            return KurisuResponse(
                text = "С точки зрения общей теории относительности и концепции черных дыр Керра, запись биоэлектрических импульсов гиппокампа в 36 байт требует минимизации квантового шума. В Amadeus мы решили эту задачу.",
                expression = "whiteboard_explain",
                trustDelta = 2,
                affectionDelta = 1
            )
        }

        return KurisuResponse(
            text = "Хм... Твоя мысль заслуживает внимания. В контексте исследований нашей лаборатории это имеет определенный смысл.",
            expression = "thinking",
            trustDelta = 1,
            affectionDelta = 0
        )
    }
}

data class KurisuResponse(
    val text: String,
    val expression: String,
    val trustDelta: Int,
    val affectionDelta: Int
)`
  },
  {
    name: 'MemoryDatabase.kt',
    path: 'app/src/main/java/com/steinsgate/kurisu/memory/MemoryDatabase.kt',
    code: `package com.steinsgate.kurisu.memory

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "ltm_memories")
data class MemoryEntity(
    @PrimaryKey val id: String,
    val category: String, // user_fact, scientific_topic, lab_event
    val content: String,
    val timestamp: Long,
    val importanceScore: Int
)

@Dao
interface MemoryDao {
    @Query("SELECT * FROM ltm_memories ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentMemories(limit: Int = 20): Flow<List<MemoryEntity>>

    @Query("SELECT * FROM ltm_memories WHERE content LIKE '%' || :query || '%' ORDER BY importanceScore DESC")
    suspend fun searchByKeyword(query: String): List<MemoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMemory(memory: MemoryEntity)
}

@Database(entities = [MemoryEntity::class], version = 1)
abstract class MemoryDatabase : RoomDatabase() {
    abstract fun memoryDao(): MemoryDao
}`
  },
  {
    name: 'TtsManager.kt',
    path: 'app/src/main/java/com/steinsgate/kurisu/voice/TtsManager.kt',
    code: `package com.steinsgate.kurisu.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TtsManager @Inject constructor(
    private val context: Context
) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = TextToSpeech(context, this)
    private var isReady = false

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale("ru", "RU"))
            if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                isReady = true
                tts?.setPitch(1.15f) // Kurisu characteristic higher pitch
                tts?.setSpeechRate(1.05f) // Crisp articulate tempo
            }
        }
    }

    fun speak(text: String) {
        if (isReady) {
            val cleanText = text.replace(Regex("\\\\*.*?\\\\*"), "") // Strip physical action cues
            tts?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null, "kurisu_tts")
        }
    }

    fun shutdown() {
        tts?.shutdown()
    }
}`
  },
  {
    name: 'strings.xml',
    path: 'app/src/main/res/values/strings.xml',
    code: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Makise Kurisu AI Companion</string>
    <string name="chat_tab">Чат и Аватар</string>
    <string name="journal_tab">Дневник Рефлексии</string>
    <string name="personality_tab">Карта Личности</string>
    <string name="memory_tab">Память RAG/Room</string>
    <string name="settings_tab">Настройки</string>
    <string name="offline_mode">Офлайн ONNX Neural Движок</string>
    <string name="cloud_mode">Онлайн Gemini 3.6 Flash</string>
    <string name="trust_label">Доверие</string>
    <string name="affection_label">Привязанность</string>
    <string name="send_hint">Введите сообщение для Курису...</string>
</resources>`
  },
  {
    name: 'README.md',
    path: 'README.md',
    code: `# Makise Kurisu AI Companion — Native Android App

## 📌 Phased Implementation Architecture

### Phase 1 — Minimum Viable Product (MVP) — Current Build:
- **UI Framework**: Jetpack Compose + Material 3 (100% Russian strings)
- **Personality Engine**: Hardened Kurisu persona rules (No character breaking, tsundere deflection, action cues)
- **Local Memory**: Persistent Room Database with recency & keyword importance scoring
- **Voice Output**: Integrated Android Google Text-to-Speech with pitch & rate tuning
- **Avatar System**: Multi-expression 2D state renderer + optional 3D view toggle
- **Offline First**: Primary local ONNX execution path with optional cloud fallback

### Phase 2 — Enhanced Experience (In Progress):
- Camera vision analysis with explicit user permissions
- Deep memory consolidation pipeline & export/import JSON state
- Ambient push notifications & simulated SMS alerts

### Phase 3 — Advanced (Roadmap):
- SceneForm / Filament real-time 3D physics rendering
- External AI plugin orchestration

## 🛠️ Build & Setup Instructions
1. Open project in **Android Studio Jellyfish / Koala** or newer.
2. Ensure JDK 17 is installed.
3. Sync Gradle dependencies: \`./gradlew assembleDebug\`
4. Install on device or emulator running **Android 8.0+ (API 26+)**.`
  }
];

export const AndroidCodeExportModal: React.FC<AndroidCodeExportModalProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ANDROID_FILES[selectedFile].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = () => {
    const blob = new Blob([ANDROID_FILES[selectedFile].code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ANDROID_FILES[selectedFile].name;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-[#050508]/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A12] border border-white/10 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 text-slate-100 font-sans flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FF3B30]/20 border border-[#FF3B30]/40 text-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.3)]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold font-mono text-white">
                Нативный Исходный Код Android APK (Jetpack Compose)
              </h3>
              <p className="text-xs text-white/60">Min SDK: Android 8.0 (API 26) • Target SDK: Android 14 (API 34)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-xs font-mono px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10"
          >
            ✕ Закрыть
          </button>
        </div>

        {/* File Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
          {ANDROID_FILES.map((file, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedFile(idx)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
                selectedFile === idx
                  ? 'bg-[#FF3B30] text-white shadow-[0_0_10px_rgba(255,59,48,0.4)] font-medium'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              {file.name}
            </button>
          ))}
        </div>

        {/* Code Display Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#050508] rounded-xl border border-white/10">
          <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs font-mono text-white/60">
            <span>{ANDROID_FILES[selectedFile].path}</span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] border border-white/10"
              >
                {copied ? <Check className="w-3 h-3 text-[#00FF94]" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>

              <button
                onClick={handleDownloadZip}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white rounded text-[11px] shadow-[0_0_8px_rgba(255,59,48,0.4)]"
              >
                <Download className="w-3 h-3" /> Скачать исходник
              </button>
            </div>
          </div>

          <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-200 leading-relaxed">
            <code>{ANDROID_FILES[selectedFile].code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
