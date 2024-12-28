// src/components/GameCanvas.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSound from 'use-sound';
import ScoreBoard from './ScoreBoard';
import QRCode from 'react-qr-code';
interface Player {
    x:number,
    y:number,
    dx:number,
    dy:number,
    name:string,
    size:number,
    shield:number,
    suspended:number,
}
function drawPlayer(ctx:CanvasRenderingContext2D, player: Player) {
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            ctx.fillStyle = player.name;
            ctx.fill();
            ctx.closePath();
            ctx.beginPath();
            const refX = player.x+player.dx*45;
            const refY = player.y+player.dy*45;
            ctx.moveTo(refX, refY);
            ctx.lineTo(player.x, player.y);
            ctx.strokeStyle = player.name;
            ctx.lineWidth=4;
            ctx.stroke();
            ctx.closePath();
            ctx.beginPath();
            ctx.arc(refX, refY, 5, 0, Math.PI * 2);
            ctx.fillStyle = player.name;
            ctx.fill();
            ctx.closePath();
            if (player.shield) {
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.size*2, 0, player.shield/50 * Math.PI * 2 );
                const grad = ctx.createLinearGradient(player.x-player.size, player.y-player.size, player.x+player.size, player.y+player.size);
                grad.addColorStop(0, "orange");
                grad.addColorStop(1, player.name);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.closePath();
            }
}

const colors = {"red":false, "green":false, "blue":false, "yellow":false, "pink":false, "black":false, "cyan":false};
const GameCanvas: React.FC = () => {
  const [colorsInUse, setColorsInUse] = useState(colors);
  const nextColor = (Object.entries(colorsInUse).find(([name, inUse])=>inUse===false)??[""])[0];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const sockRef = useRef<WebSocket | null> (socket);
  const [shootSound] = useSound("shoot.mp3", {volume:0.4});
  const [score, setScore] = useState({});
  const [hitSound] = useSound("test_sound.mp3");
  const [shieldSound] = useSound("shield.mp3");
  const [players, setPlayers] = useState<{[key:string]:{dx:number;dy:number;mag:number;b2:boolean}}>({});
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
    const ws = new WebSocket("ws://192.168.228.224:9160");
    ws.onopen = () => {
        ws.send('view');
    };
    ws.onmessage = (event:MessageEvent<string>) => {
        const components = event.data.split(":");
        const name=components[0];
        if (name==="view") {return;}
        if (components[1]==="joined") {
            playersRef.current[name] = {dx:0, dy:0, mag:0, b2:false};
            setMessage(event.data);
            if (Object.keys(colorsInUse).includes(name)) {
                setColorsInUse(prev=>{return {...prev, [name]:true}});
            }
            return;
        }
        if (components[1]===("disconnected")) {
            delete playersRef.current[name];
            setMessage(event.data);
            if (Object.keys(colorsInUse).includes(name)) {
                setColorsInUse(prev=>{return {...prev, [name]:false}});
            }
            return;
        }
        if (components[1]===("b1")) {
            setProjectiles(proj=> [...proj, {name:name, ttl:80}]);
            return;
        }
        if (components[1]===("b2")) {
            playersRef.current[name].b2 = true;
        }
        if (components[1]==="m") {
            const dy = Number(components.pop());
            const dx = Number(components.pop());
            const mag = Number(components.pop());
            playersRef.current[name].dx=dx;
            playersRef.current[name].dy=dy;
            playersRef.current[name].mag=mag;
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
            if (state.mag!==0 && !player.suspended) {
                player.dx = state.dx/state.mag;
                player.dy = state.dy/state.mag;
            }
            const capMag = player.suspended?player.suspended:Math.min(160, state.mag);
            player.x += player.dx * capMag/8 * (1+player.shield/20);
            player.y += player.dy * capMag/8 * (1+player.shield/20);
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
            if (player.suspended) {
                player.suspended -= 20;
                if (player.suspended < 0) {player.suspended=0;}
            }
            if (player.shield) {
                player.shield-=2;
                Object.entries(gameState.players).filter(val=> val[0]!==name && (!val[1].suspended)).map(val=>{
                    const enemy = val[1]
                    if (
                        (Math.abs(enemy.x-player.x)<50) && (Math.abs(enemy.y-player.y)<50)
                    ) {
                        enemy.dx = player.dx;
                        enemy.dy = player.dy;
                        enemy.mag = 50;
                        enemy.suspended=400;
                    }
                })
            }
        if (state.b2) {
            state.b2 = false;
            player.shield = 50;
            shieldSound();
        }
        } else {
            const spawnX = Math.random()*window.innerWidth;
            const spawnY = Math.random()*window.innerHeight;
            gameState.players[name] = {suspended:0, shield:0, size:size,name:name, x:spawnX, y:spawnY, dx:0, dy:0, dead:false};
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
                if (!player.shield) {
                    player.dead=true;
                    setScore(prev=> {
                        let next = {...prev};
                        if (p.name in next) {
                        next[p.name] +=1;
                        } else {
                            next[p.name] = 1;
                        }
                        return next;
                    })
                }
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

  return <div style={{display:"flex", flexDirection:"row", gap:"1rem"}}>
    <div>
    {nextColor &&
    <QRCode value={`http://192.168.228.224:5173/${nextColor??""}`} fgColor={nextColor} size={128}></QRCode>
    }
    <ScoreBoard score={score} reset={()=>{
        setScore({});
    }}>
    </ScoreBoard>
    </div>
    <div>
  <canvas ref={canvasRef} style={{ borderRadius: "1rem", width:"100%",boxSizing:"border-box",display: 'block',
  borderStyle: "solid"}} />
    <div> {message}
    </div>

    </div>
  </div>;
};

export default GameCanvas;

