"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const QUESTIONS = [
  { id: "q0", text: "What is the most important bottleneck to AI boosting GDP in the next 10 years?", options: ["Chips", "Energy", "Data", "General AI regulation", "Specific industry regulations", "Organizational adaptation (J-curve)", "Other"], shorts: ["Chips", "Energy", "Data", "AI reg.", "Industry reg.", "Org. J-curve", "Other"] },
  { id: "q1", text: "Which part of the AI stack will capture the greatest share of surplus (excluding gov or consumers)?", options: ["Model labs", "Chip makers", "Cloud services", "Software companies & AI integrators/consultants", "AI-native industry-specific startups", "AI-agile industry-specific incumbents"], shorts: ["Model labs", "Chip makers", "Cloud", "Software & integrators", "AI-native startups", "Agile incumbents"] },
  { id: "q2", text: "How fast will annualized real GDP growth be over the next 10 years?", options: ["Below 0%", "0–1%", "1–1.5%", "1.5–2%", "2–2.5%", "2.5–3%", "3–5%", "Above 5% (takeoff)"], shorts: ["<0%", "0–1%", "1–1.5%", "1.5–2%", "2–2.5%", "2.5–3%", "3–5%", ">5%"] },
  { id: "q3", text: "Should frontier AI be nationalized?", options: ["Yes — AI is like nuclear weapons and threatens the state's monopoly on violence", "Yes — AI should be owned by the people and run for the common weal", "Yes — AI is an existential risk and we need government to slow progress", "No — Capitalism FTW"], shorts: ["Yes: nukes", "Yes: common weal", "Yes: x-risk brake", "No: Capitalism FTW"] },
] as const;

const COLORS = ["#7c83ff", "#42d6a4", "#ffbe55", "#ff6f91", "#ad8cff", "#4dd6e1", "#df8b57", "#b6c449"];
const NAMES = ["Ada", "Milton", "Joan", "Kenneth", "Elinor", "Paul", "Anna", "Bob", "Esther", "Tom", "Daron", "Claudia", "Erik", "Susan", "Andy", "Janet", "Tyler", "Emi", "Raj", "Sofia", "Dmitri", "Hannah", "Leo", "Priya", "Marcus", "Yael", "Chen", "Olga", "Sam", "Ingrid", "Kofi", "Maria", "Jun", "Talia", "Omar", "Grace", "Viktor", "Noa", "Diego", "Ruth"];
const WEIGHTS = [[.13,.16,.07,.12,.14,.32,.06],[.22,.26,.13,.12,.1,.17],[.02,.06,.14,.24,.24,.16,.11,.03],[.1,.12,.18,.6]];
type Answers = Record<string, number>;
type Person = { id: string; name: string; selfie: string | null; answers: Answers; createdAt: number; demo?: boolean };

function seeded(seed: number) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function samples(): Person[] { const r = seeded(20260721); return NAMES.map((name, i) => ({ id: `sample-${i}`, name, selfie: null, createdAt: 0, demo: true, answers: Object.fromEntries(QUESTIONS.map((q, qi) => { const x = r(); let a = 0; let pick = WEIGHTS[qi].length - 1; for (let j = 0; j < WEIGHTS[qi].length; j++) { a += WEIGHTS[qi][j]; if (x < a) { pick = j; break; } } return [q.id, pick]; })) })); }
const SAMPLE_PEOPLE = samples();
const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();
const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

async function shrink(file: File) {
  const src = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const c = document.createElement("canvas"); c.width = c.height = 120; const ctx = c.getContext("2d")!; const side = Math.min(img.width, img.height); ctx.drawImage(img, (img.width-side)/2, (img.height-side)/2, side, side, 0, 0, 120, 120); return c.toDataURL("image/jpeg", .58);
}

function Avatar({ person, size=44, hot=false }: { person: Person; size?: number; hot?: boolean }) {
  const style = { width: size, height: size, minWidth: size, background: `hsl(${hue(person.name)} 55% 45%)` };
  return person.selfie ? <img className={`avatar ${hot ? "hot" : ""}`} style={style} src={person.selfie} alt={person.name} title={person.name}/> : <span className={`avatar ${hot ? "hot" : ""}`} style={style} title={person.name}>{initials(person.name)}</span>;
}

function Survey({ onProjector }: { onProjector: () => void }) {
  const [step, setStep] = useState(0), [name, setName] = useState(""), [selfie, setSelfie] = useState<string|null>(null), [answers, setAnswers] = useState<Answers>({}), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const submit = async () => { setBusy(true); setError(""); try { const res = await fetch("/api/responses", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({ name, selfie, answers }) }); if (!res.ok) throw new Error(); setStep(QUESTIONS.length + 1); } catch { setError("We couldn't save that response. Please try again."); } finally { setBusy(false); } };
  if (step === 0) return <main className="survey shell"><header><p className="eyebrow">Justified Posteriors</p><h1>The party poll</h1><p className="lede">Four questions on the economics of AI. Your face and answers go up on the big screen — that’s the point.</p></header><label>Name<input value={name} maxLength={30} onChange={e=>setName(e.target.value)} placeholder="First name is fine" autoFocus/></label><div><span className="label">Selfie <em>optional</em></span><div className="photo-row">{selfie ? <img className="preview" src={selfie} alt="Your selfie"/> : <span className="preview placeholder">No photo yet</span>}<button className="secondary" onClick={()=>file.current?.click()}>{selfie ? "Retake" : "Take selfie"}</button></div><input ref={file} hidden type="file" accept="image/*" capture="user" onChange={async e=>{const f=e.target.files?.[0]; if(f) try{setSelfie(await shrink(f));}catch{setError("We couldn't read that photo. You can continue without it.");}}}/><p className="hint">Skip it and you’ll appear as your initials. Photos are visible to everyone at the party.</p></div>{error&&<p className="error">{error}</p>}<button className="primary" disabled={!name.trim()} onClick={()=>setStep(1)}>Start the poll <span>→</span></button><button className="host-link" onClick={onProjector}>Open projector view</button></main>;
  if (step > QUESTIONS.length) return <main className="survey shell done"><Avatar person={{id:"me",name,selfie,answers,createdAt:0}} size={92}/><p className="eyebrow">Response saved</p><h1>Posterior recorded, {name.trim().split(" ")[0]}.</h1><p className="lede">Watch the big screen — you’re in the data now.</p><button className="secondary" onClick={onProjector}>See the live results</button></main>;
  const q = QUESTIONS[step-1]; const chosen = answers[q.id];
  return <main className="survey shell"><div className="progress"><span style={{width:`${step/QUESTIONS.length*100}%`}}/></div><p className="eyebrow">Question {step} of {QUESTIONS.length}</p><h2>{q.text}</h2><div className="options">{q.options.map((opt,i)=><button key={opt} className={chosen===i?"selected":""} onClick={()=>setAnswers({...answers,[q.id]:i})}><span>{String.fromCharCode(65+i)}</span>{opt}</button>)}</div>{error&&<p className="error">{error}</p>}<div className="actions">{step>1&&<button className="secondary" onClick={()=>setStep(step-1)}>Back</button>}<button className="primary" disabled={chosen===undefined||busy} onClick={()=>step===QUESTIONS.length?submit():setStep(step+1)}>{busy?"Saving…":step===QUESTIONS.length?"Submit response":"Next question →"}</button></div></main>;
}

function rows(people: Person[]) { return [["Name",...QUESTIONS.map(q=>q.text),"Timestamp","SampleData"],...people.map(p=>[p.name,...QUESTIONS.map(q=>q.options[p.answers[q.id]]||""),p.createdAt?new Date(p.createdAt).toISOString():"",p.demo?"yes":"no"])]; }

function Projector({ onSurvey }: { onSurvey: () => void }) {
  const [people,setPeople]=useState<Person[]>([]), [showSample,setShowSample]=useState(true), [qi,setQi]=useState(0), [spot,setSpot]=useState(""), [confirm,setConfirm]=useState(false), [toast,setToast]=useState("");
  const load=useCallback(async()=>{try{const r=await fetch("/api/responses",{cache:"no-store"});if(r.ok)setPeople((await r.json()).responses);}catch{}},[]);
  useEffect(()=>{load();const a=setInterval(load,5000),b=setInterval(()=>setQi(i=>(i+1)%QUESTIONS.length),14000),c=setInterval(()=>setSpot((showSample&&people.length===0?SAMPLE_PEOPLE:people)[Math.floor(Math.random()*(showSample&&people.length===0?SAMPLE_PEOPLE:people).length)]?.id||""),6000);return()=>{clearInterval(a);clearInterval(b);clearInterval(c)}},[load,people,showSample]);
  const display=showSample&&people.length===0?SAMPLE_PEOPLE:people, demo=display===SAMPLE_PEOPLE, q=QUESTIONS[qi];
  const columns=useMemo(()=>q.options.map((_,i)=>display.filter(p=>p.answers[q.id]===i)),[display,q]);
  const flash=(s:string)=>{setToast(s);setTimeout(()=>setToast(""),3500)};
  const exportCsv=()=>{const csv=rows(display).map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="justified-posteriors-party.csv";a.click();flash("CSV downloaded.")};
  const clear=async()=>{await fetch("/api/responses",{method:"DELETE"});setPeople([]);setShowSample(false);setConfirm(false);flash("All responses cleared.")};
  const spotlight=display.find(p=>p.id===spot);
  return <main className="projector"><header><div><p className="eyebrow">Justified Posteriors <i/> Live results</p><h1>{q.text}</h1></div><div className="count"><strong>{display.length}</strong><span>{demo?"sample respondents":"respondents"}</span>{demo&&<small>Demo data</small>}</div></header><section className="chart">{columns.map((voters,i)=><div className="column" key={q.options[i]}><strong>{voters.length}</strong><div className="people">{voters.map(p=><Avatar key={p.id} person={p} size={columns.length>=7?38:46} hot={p.id===spot}/>)}</div><i style={{background:COLORS[i]}}/><span>{q.shorts[i]}</span></div>)}</section><footer><div className="dots">{QUESTIONS.map((_,i)=><button key={i} aria-label={`Show question ${i+1}`} className={i===qi?"active":""} onClick={()=>setQi(i)}/>)}</div><div className="spot">{toast|| (spotlight&&<>✨ <b>{spotlight.name}</b> → {q.shorts[spotlight.answers[q.id]]}</>)}</div><div className="tools"><button onClick={exportCsv}>Export CSV</button>{demo?<button onClick={()=>setShowSample(false)}>Hide demo</button>:people.length===0&&<button onClick={()=>setShowSample(true)}>Show demo</button>}{confirm?<><button className="danger" onClick={clear}>Confirm wipe</button><button onClick={()=>setConfirm(false)}>Cancel</button></>:<button onClick={()=>setConfirm(true)}>Clear</button>}<button onClick={onSurvey}>Guest view ↗</button></div></footer></main>;
}

export default function Home(){const[mode,setMode]=useState<"survey"|"projector">("survey");return mode==="projector"?<Projector onSurvey={()=>setMode("survey")}/>:<Survey onProjector={()=>setMode("projector")}/>;}
