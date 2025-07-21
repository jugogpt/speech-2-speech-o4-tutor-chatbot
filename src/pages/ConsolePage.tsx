import React, { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Running a local relay server will allow you to hide your API key and run custom logic on the server.
 * Set REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081 in your env to use it.
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { Map } from '../components/Map';

// ---- Avatar assets ---------------------------------------------------------
const BodyImg = '/imgs/Body.png';
const HeadIdleImg = '/imgs/Head_idle.png';
const HeadThinkImg = '/imgs/Head_think.png';
const HeadTalkImg = '/imgs/Head_talk.png';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: { value: number; units: string };
  wind_speed?: { value: number; units: string };
}

interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

type AvatarState = 'idle' | 'think' | 'talk';

/* -------------------------------------------------------------------------- */
/* Avatar Bar Component                                                        */
/* -------------------------------------------------------------------------- */
interface StudentAvatarBarProps {
  state: AvatarState;
}

const StudentAvatarBar: React.FC<StudentAvatarBarProps> = ({ state }) => {
  return (
    <div className="student-avatar-bar" role="img" aria-label={`avatar-${state}`}>
      <div className={`student-avatar student-avatar--${state}`}>
        <img src={BodyImg} alt="Avatar body" className="student-avatar__body" draggable={false} />
        <img src={HeadIdleImg} alt="Avatar head idle" className="student-avatar__head student-avatar__head--idle" draggable={false} />
        <img src={HeadThinkImg} alt="Avatar head thinking" className="student-avatar__head student-avatar__head--think" draggable={false} />
        <img src={HeadTalkImg} alt="Avatar head talking" className="student-avatar__head student-avatar__head--talk" draggable={false} />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Main Page                                                                   */
/* -------------------------------------------------------------------------- */
export function ConsolePage() {
  const [apiKey, setApiKey] = useState<string>('');
  const clientRef = useRef<RealtimeClient | null>(null);

  // Avatar state machine -----------------------------------------------------
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const avatarTimeoutRef = useRef<number | null>(null);
  const setAvatarStateSafely = (s: AvatarState, holdMs = 0) => {
    if (avatarTimeoutRef.current) {
      window.clearTimeout(avatarTimeoutRef.current);
      avatarTimeoutRef.current = null;
    }
    if (holdMs > 0) {
      avatarTimeoutRef.current = window.setTimeout(() => setAvatarState(s), holdMs);
    } else {
      setAvatarState(s);
    }
  };

  useEffect(() => {
    return () => {
      if (avatarTimeoutRef.current) window.clearTimeout(avatarTimeoutRef.current);
    };
  }, []);

  // Init API key -------------------------------------------------------------
  useEffect(() => {
    const storedApiKey = localStorage.getItem('tmp::voice_api_key') || '';
    setApiKey(storedApiKey);
    if (!LOCAL_RELAY_SERVER_URL && !storedApiKey) {
      const newApiKey = prompt('OpenAI API Key') || '';
      if (newApiKey) {
        localStorage.setItem('tmp::voice_api_key', newApiKey);
        setApiKey(newApiKey);
      }
    }
  }, []);

  // Init client when key available -------------------------------------------
  useEffect(() => {
    if (apiKey || LOCAL_RELAY_SERVER_URL) {
      clientRef.current = new RealtimeClient(
        LOCAL_RELAY_SERVER_URL ? { url: LOCAL_RELAY_SERVER_URL } : { apiKey, dangerouslyAllowAPIKeyInBrowser: true },
      );
    }
  }, [apiKey]);

  // Audio refs --------------------------------------------------------------
  const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));

  // UI refs -----------------------------------------------------------------
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  // State -------------------------------------------------------------------
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{ [key: string]: boolean }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({ lat: 37.775593, lng: -122.418137 });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  // Format event times ------------------------------------------------------
  const formatTime = useCallback((timestamp: string) => {
    const t0 = new Date(startTimeRef.current).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  // Connect -----------------------------------------------------------------
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();
    client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }]);

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  // Disconnect --------------------------------------------------------------
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({ lat: 37.775593, lng: -122.418137 });
    setMarker(null);

    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();

    setAvatarStateSafely('idle');
  }, []);

  // Delete an item ----------------------------------------------------------
  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    client.deleteItem(id);
  }, []);

  // Push-to-talk recording --------------------------------------------------
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => {
      client.appendInputAudio(data.mono);
    });
    setAvatarStateSafely('idle');
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    if (client.inputAudioBuffer.byteLength > 0) {
      client.realtime.send('input_audio_buffer.commit', {});
      client.conversation.queueInputAudio(client.inputAudioBuffer);
      client.inputAudioBuffer = new Int16Array(0);
    }
    setAvatarStateSafely('think');
  };

  // Change turn detection ---------------------------------------------------
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({ turn_detection: value === 'none' ? null : { type: 'server_vad' } });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  // Inject context from transcript ------------------------------------------
  const injectContext = async (transcript: string) => {
    const client = clientRef.current;
    if (!client) throw new Error('RealtimeClient is not initialized');
    transcript = transcript.trim();
    if (!transcript) return;
    const response = await fetch(`/api/context?query=${encodeURIComponent(transcript)}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    client.sendUserMessageContent([{ type: 'input_text', text: data.message }]);
    if (client.getTurnDetectionType() === null) {
      client.createResponse();
    }
    setAvatarStateSafely('think');
  };

  // Auto-scroll events ------------------------------------------------------
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  // Auto-scroll conversation ------------------------------------------------
  useEffect(() => {
    const conversationEls = [].slice.call(document.body.querySelectorAll('[data-conversation-content]'));
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  // Visualization loops -----------------------------------------------------
  useEffect(() => {
    let isLoaded = true;
    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;
    const render = () => {
      if (!isLoaded) return;
      if (clientCanvas) {
        if (!clientCanvas.width || !clientCanvas.height) {
          clientCanvas.width = clientCanvas.offsetWidth;
          clientCanvas.height = clientCanvas.offsetHeight;
        }
        clientCtx = clientCtx || clientCanvas.getContext('2d');
        if (clientCtx) {
          clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
          const result = wavRecorder.recording ? wavRecorder.getFrequencies('voice') : { values: new Float32Array([0]) };
          WavRenderer.drawBars(clientCanvas, clientCtx, result.values, '#0099ff', 10, 0, 8);
        }
      }
      if (serverCanvas) {
        if (!serverCanvas.width || !serverCanvas.height) {
          serverCanvas.width = serverCanvas.offsetWidth;
          serverCanvas.height = serverCanvas.offsetHeight;
        }
        serverCtx = serverCtx || serverCanvas.getContext('2d');
        if (serverCtx) {
          serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
          const result = wavStreamPlayer.analyser ? wavStreamPlayer.getFrequencies('voice') : { values: new Float32Array([0]) };
          WavRenderer.drawBars(serverCanvas, serverCtx, result.values, '#009900', 10, 0, 8);
        }
      }
      window.requestAnimationFrame(render);
    };
    render();
    return () => {
      isLoaded = false;
    };
  }, []);

  // Core RealtimeClient + avatar state hooks --------------------------------
  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;
    if (!client) return;

    client.updateSession({ instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Tools -----------------------------------------------------------------
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Lowercase underscored key.' },
            value: { type: 'string', description: 'Arbitrary string value.' },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((kv) => ({ ...kv, [key]: value }));
        return { ok: true };
      },
    );

    client.addTool(
      {
        name: 'get_weather',
        description: 'Retrieves weather for a lat/lng pair.',
        parameters: {
          type: 'object',
          properties: {
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' },
            location: { type: 'string', description: 'Name of location' },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location }: { [key: string]: any }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`,
        );
        const json = await result.json();
        const temperature = { value: json.current.temperature_2m as number, units: json.current_units.temperature_2m as string };
        const wind_speed = { value: json.current.wind_speed_10m as number, units: json.current_units.wind_speed_10m as string };
        setMarker({ lat, lng, location, temperature, wind_speed });
        return json;
      },
    );

    // Realtime events -> drive avatar state ---------------------------------
    client.on('realtime.event', async (rtEvent: RealtimeEvent) => {
      const t = rtEvent.event.type;
      if (t === 'input_audio_buffer.commit' || t === 'conversation.item.input_audio_transcription.completed') {
        setAvatarStateSafely('think');
      } else if (t.startsWith('response.') || t.startsWith('conversation.item.output')) {
        setAvatarStateSafely('talk');
      } else if (t === 'response.completed') {
        setAvatarStateSafely('idle', 300);
      }

      if (t === 'conversation.item.input_audio_transcription.completed') {
        await injectContext(rtEvent.event.transcript);
      }

      setRealtimeEvents((prev) => {
        const lastEvent = prev[prev.length - 1];
        if (lastEvent?.event.type === t) {
          lastEvent.count = (lastEvent.count || 0) + 1;
          return prev.slice(0, -1).concat(lastEvent);
        } else {
          return prev.concat(rtEvent);
        }
      });
    });

    client.on('error', (event: any) => console.error(event));

    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
      setAvatarStateSafely('idle');
    });

    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
        setAvatarStateSafely('talk');
      }
      if (item.status === 'completed') {
        if (item.role === 'assistant') {
          setAvatarStateSafely('idle', 500);
        }
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(item.formatted.audio, 24000, 24000);
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, [clientRef.current]);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <span>Sqarqit Callbot</span>
        </div>
      </div>

      <StudentAvatarBar state={avatarState} />

      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && 'awaiting connection...'}
              {realtimeEvents.map((realtimeEvent) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event } as any;
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">{formatTime(realtimeEvent.time)}</div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) delete expanded[id];
                          else expanded[id] = true;
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${event.type === 'error' ? 'error' : realtimeEvent.source}`}
                        >
                          {realtimeEvent.source === 'client' ? <ArrowUp /> : <ArrowDown />}
                          <span>{event.type === 'error' ? 'error!' : realtimeEvent.source}</span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">{JSON.stringify(event, null, 2)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && 'awaiting connection...'}
              {items.map((conversationItem) => (
                <div className="conversation-item" key={conversationItem.id}>
                  <div className={`speaker ${conversationItem.role || ''}`}>
                    <div>{(conversationItem.role || conversationItem.type).replaceAll('_', ' ')}</div>
                    <div className="close" onClick={() => deleteConversationItem(conversationItem.id)}>
                      <X />
                    </div>
                  </div>
                  <div className="speaker-content">
                    {conversationItem.type === 'function_call_output' && (
                      <div>{conversationItem.formatted.output}</div>
                    )}
                    {!!conversationItem.formatted.tool && (
                      <div>
                        {conversationItem.formatted.tool.name}({conversationItem.formatted.tool.arguments})
                      </div>
                    )}
                    {!conversationItem.formatted.tool && conversationItem.role === 'user' && (
                      <div>
                        {conversationItem.formatted.transcript ||
                          (conversationItem.formatted.audio?.length
                            ? '(awaiting transcript)'
                            : conversationItem.formatted.text || '(item sent)')}
                      </div>
                    )}
                    {!conversationItem.formatted.tool && conversationItem.role === 'assistant' && (
                      <div>
                        {conversationItem.formatted.transcript ||
                          conversationItem.formatted.text ||
                          '(truncated)'}
                      </div>
                    )}
                    {conversationItem.formatted.file && (
                      <audio src={conversationItem.formatted.file.url} controls />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="content-actions">
            <Toggle
              defaultValue={false}
              labels={['manual', 'vad']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={isConnected ? disconnectConversation : connectConversation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}