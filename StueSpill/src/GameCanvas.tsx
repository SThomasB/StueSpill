// src/components/GameCanvas.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSound from 'use-sound';
interface Player {x:number, y:number, dx:number, dy:number, name:string, size:number}
function drawPlayer(ctx:CanvasRenderingContext2D, player: Player) {

            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            ctx.fillStyle = player.name;
            ctx.fill();
            ctx.closePath();
            ctx.beginPath();
            const refX = player.x+player.dx*50;
            const refY = player.y+player.dy*50;
            ctx.moveTo(refX, refY);
            ctx.lineTo(player.x, player.y);
            ctx.strokeStyle = player.name;
            ctx.lineWidth=5;
            ctx.stroke();
            ctx.closePath();
            ctx.beginPath();
            ctx.arc(refX, refY, 5, 0, Math.PI * 2);
            ctx.fillStyle = player.name;
            ctx.fill();
            ctx.closePath();
}
const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const sockRef = useRef<WebSocket | null> (socket);
  const [shootSound] = useSound("shoot.mp3");
  const [hitSound] = useSound("test_sound.mp3");
  const [players, setPlayers] = useState<{[key:string]:{dx:number;dy:number;mag:number}}>({});
  const [projectiles, setProjectiles] = useState<{name:string; ttl:number}[]>([]);
  const projectilesRef = useRef(projectiles);
  const audioShootRef = useRef(null);
  projectilesRef.current = projectiles;
  const playersRef = useRef(players);
  playersRef.current = players;
  const mousePosition = useRef({x:0, y:0});
    const [message, setMessage] = useState("");
  const connectWebSocket = useCallback(()=> {
    if (sockRef.current && sockRef.current.readyState===WebSocket.OPEN) {
            return;
        }
    const ws = new WebSocket("ws://192.168.10.96:9160");
    ws.onopen = () => {
        ws.send('view');
    };
    ws.onmessage = (event:MessageEvent<string>) => {
        const components = event.data.split(":");
        const name=components[0];
        if (name==="view") {return;}
        if (components[1]==="joined") {
            playersRef.current[name] = {dx:0, dy:0, mag:0};
            setMessage(event.data);
            return;
        }
        if (components[1]===("disconnected")) {
            delete playersRef.current[name];
            setMessage(event.data);
            return;
        }
        if (components[1]===("b1")) {
            setProjectiles(proj=> [...proj, {name:name, ttl:150}]);
            return;
        }
        if (components[1]==="m") {
            const dy = Number(components.pop());
            const dx = Number(components.pop());
            const mag = Number(components.pop());
            playersRef.current[name]={dx:dx, dy:dy, mag:mag};
            return;
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
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight-40;
    const size = (canvas.width+canvas.height)/2 * 0.02
    let animationFrameId: number;
    const radius = 50;
    let gameState = {players: {}, projectiles:[]};
    let dx = 0;
    let dy = 0;
    let p = 0;
    // Game loop function
    const gameLoop = () => {
      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      Object.entries(gameState.players).forEach(val => {
        if ((val[0] in playersRef.current)) {return;}
        delete gameState.players[val[0]];
      });
      Object.entries(playersRef?.current).forEach(val => {
        const name = val[0];
        const state = val[1];
        if (name in gameState.players) {
            let player = gameState.players[name];
            if (player.dead) {return;}
            drawPlayer(context, player);
            p = player.p;
            if (state.mag!==0) {
                player.dx = state.dx/state.mag;
                player.dy = state.dy/state.mag;
            }
            player.x += player.dx * state.mag/8;
            player.y += player.dy * state.mag/8;
            if (window.innerHeight < player.y) {
                player.y = 0;
            }
            if (player.y < 0) {
                player.y = window.innerHeight;
            }
            if (window.innerWidth < player.x) {
                player.x = 0;
            }
            if (player.x < 0 ) {
                player.x = window.innerWidth;
            };
        } else {
            gameState.players[name] = {size:size,name:name, x:50, y:50, dx:0, dy:0, dead:false};
        }

      });
      projectilesRef.current.forEach(p=>{
            const player = gameState.players[p.name];
            if (!player) {return;}

            const dx = player.dx;
            const dy = player.dy;
            const dx_ = dx*30;
            const dy_= dy*30;
            //audioShootRef?.current?.play();
            shootSound();
            gameState.projectiles.push({...p, x:player.x, y:player.y, dy:dy_, dx:dx_ })})
      setProjectiles([]);

      gameState.projectiles = gameState.projectiles.map(it=>{
        let p = {...it};

        Object.entries(gameState.players).filter(val=>{
            return ((val[0] !== p.name) && (!val[1].dead));
        }).map(val=>{
        let player = val[1];
        const name = val[0];
        if ((Math.abs(p.x - player.x-25) < 50) && (Math.abs(p.y - player.y-25)<50)) {
                hitSound();
                player.dead=true;
                p.ttl = 0;
                sockRef?.current?.send(`${name}:hit`);
                return;
        }

        })
        p.ttl-=1;
        context.beginPath();
        context.arc(p.x, p.y, 10, 0, Math.PI * 2);
        context.fillStyle = p.name;
        context.fill();
        context.closePath();
        p.x+= p.dx;
        p.y+= p.dy;
        return p;

      }).filter(it=>it.ttl>0);
      // Request the next frame
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // Start the game loop
    animationFrameId = requestAnimationFrame(gameLoop);

    // Cleanup on component unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <><canvas ref={canvasRef} style={{ width:"100%",boxSizing:"border-box",display: 'block',
  borderStyle: "solid"}} />
    <div> {message}
    </div>
    <audio ref={audioShootRef}>
        <source src="test_sound.mp3" type="audio/mpeg"/>
    </audio>
  </>;
};

export default GameCanvas;

