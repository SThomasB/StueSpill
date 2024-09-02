import './ScoreBoard.css'
interface ScoreBoardProps {
    score: {[key:string]:number},
    reset: ()=>void,
}

export default function ScoreBoard (props: ScoreBoardProps) {

    return (
        <div className="scoreboard">
        {Object.entries(props.score).sort((it, other)=>other[1]-it[1]).map(it => (
        <div className="scoreRow"
        style={{
            borderColor: it[0],
            borderStyle: "solid",

        }}>
            {it[1]} p
        </div>
        ))}
        <button onClick={props.reset}>
            reset
        </button>
        </div>
        )
 }

