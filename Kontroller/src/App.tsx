import { useCallback, useEffect, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'





interface Click {x: number, y: number}
function App() {
  const playerName = window.location.href.split("/").pop()
  const [B1, setB1] = useState(5);
  const [B2, setB2] = useState(1);
  const [click, setClick] = useState<Click>({x:0,y:0});
  const touchpad = useRef<HTMLDivElement | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const sockRef = useRef<WebSocket | null> (socket);
  const [touchPos, setTouchPos] = useState<number[]>([]);
  const [wasHit, setWasHit] = useState(false);
  const [message, setMessage] = useState("");
  const connectWebSocket = useCallback(()=> {
    if (sockRef.current && sockRef.current.readyState===WebSocket.OPEN) {
            return;
        }
    const ws = new WebSocket("ws://192.168.10.96:9160");
    ws.onopen = () => {
        if (!playerName) {return;}
        ws.send(playerName);
    };
    ws.onmessage = (event) => {
        console.log(event.data);
        if (!event.data.startsWith("view:")) {return;}
        const msg = event.data.split(":");
        if (msg[1] === playerName) {
            if (msg[2]==="hit") {
                setWasHit(true);
                try {
                navigator.vibrate(1000);
                } catch {};
            }
        }
    }
    ws.onclose = (event) => {
            setTimeout(() => {
                console.log('Reconnecting to WebSocket server....');
                connectWebSocket();
            }, 5000);
    }
    sockRef.current = ws;
  }, []);
  useEffect(()=>{
    connectWebSocket();
    return () => {
        if (sockRef.current) {
            sockRef.current.close();
        }
    }
  }, [connectWebSocket]);
  const sampleTouchRef = useRef<number | null>(null);
  const handleTouchEnd = () => {
    sockRef?.current?.send(`m:0:0:0`);
    setTouchActive(false);
  }
  const [touchActive, setTouchActive] = useState(true);
  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchActive(true);
    const rect = touchpad?.current?.getBoundingClientRect();
    const touch = event.touches[0];
    if (rect===null || rect===undefined) {return;}
    const centerY = rect.height/2;
    const centerX = rect.width/2;
    const x = Math.round(touch.clientX-(rect.left+centerX));
    const y = Math.round(touch.clientY-(rect.top+centerY));
    const mag = Math.sqrt(x*x + y*y);
    const dx = x;
    const dy = y;
    sockRef?.current?.send(`m:${Math.round(mag)}:${Math.round(dx)}:${Math.round(dy)}`);
  // CSS linear-gradient with calculated angles
  }
  const handleClickB1 = (e) => {
    e.stopPropagation();
    if (B1 === 0) {
    return;}
    if (B1 === 1) {
    try {
        navigator.vibrate(700);
    } catch {}
    setTimeout(()=>{
            setB1(5);
        }, 2000);
    }
    sockRef?.current?.send(`b1`);
    setB1(it=>it-1);
  }
  const handleClickB2 = (e) => {
    e.stopPropagation();
    if (B2 == 0) {
        return;
    }
    if (B2 == 1) {
        setTimeout(()=>{setB2 (1);}, 10000);
    }
    sockRef?.current?.send(`b2`);
    setB2(it=>it-1);
  }
  if (wasHit) {
    return <button onClick={()=>window.location.reload(false)}>
        You dead! Click here to revive
    </button>
  }
  return (
    <div className="controller">
      <div
      className="touchpad"
      ref={touchpad}
      onTouchStart={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchMove={(event) => {
        if (sampleTouchRef.current) {return;}
        handleTouchMove(event);
        sampleTouchRef.current = setTimeout(()=>{
        sampleTouchRef.current = null;
      }, 30);
      }}>
        -|-
      </div>
      <div className="buttons">
        <div className="b1" onTouchStart={handleClickB1} style={{borderColor:playerName}}>
            <div style={{userSelect: "none"}}>{B1}</div>
        </div>
        <div className="b2" onTouchStart={handleClickB2} style={{borderColor:playerName}}>
            <div style={{userSelect: "none"}}>{B2}</div>
        </div>
      </div>
    </div>
  )
}




export default App
