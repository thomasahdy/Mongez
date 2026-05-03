import { useCallback, useMemo, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

const WHITEBOARD_STORAGE_KEY = 'mongez-whiteboard-scene'

function getSafeAppState(appState) {
  const safeAppState = appState && typeof appState === 'object' ? { ...appState } : {}

  // Excalidraw expects collaborators to be a Map-like structure.
  // Old persisted data can turn it into a plain object after JSON parse.
  safeAppState.collaborators = new Map()

  return safeAppState
}

function WhiteBoardPage() {
  const [saveStatus, setSaveStatus] = useState('Saved')

  const currentTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    [],
  )

  const initialData = useMemo(() => {
    try {
      const saved = localStorage.getItem(WHITEBOARD_STORAGE_KEY)
      if (!saved) {
        return {
          appState: {
            viewBackgroundColor: '#f8fafc',
          },
        }
      }

      const parsed = JSON.parse(saved)
      return {
        elements: parsed.elements || [],
        appState: {
          viewBackgroundColor: '#f8fafc',
          ...getSafeAppState(parsed.appState),
        },
        files: parsed.files || {},
      }
    } catch {
      return {
        appState: {
          viewBackgroundColor: '#f8fafc',
        },
      }
    }
  }, [])

  const handleSceneChange = useCallback((elements, appState, files) => {
    try {
      const payload = JSON.stringify({
        elements,
        appState: getSafeAppState(appState),
        files,
      })
      localStorage.setItem(WHITEBOARD_STORAGE_KEY, payload)
      setSaveStatus('Saved')
    } catch {
      setSaveStatus('Save failed')
    }
  }, [])

  const clearBoard = useCallback(() => {
    localStorage.removeItem(WHITEBOARD_STORAGE_KEY)
    window.location.reload()
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        <section className="h-[82vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_55px_rgba(15,23,42,0.1)]">
          <Excalidraw
            initialData={initialData}
            onChange={handleSceneChange}
            theme="light"
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: true,
                clearCanvas: true,
                export: {
                  saveFileToDisk: true,
                },
                loadScene: true,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            }}
          />
        </section>
      </main>
    </div>
  )
}

export default WhiteBoardPage
