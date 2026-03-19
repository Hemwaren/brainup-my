"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye, EyeOff, Brain, Sparkles, CheckCircle2, ArrowRight,
  ChevronLeft, ChevronRight,
} from "lucide-react";

type Role = "EMPLOYEE" | "HR";
type InviteStatus = "IDLE" | "CHECKING" | "VALID" | "INVALID";

const SCENES = [
  { id:"learning",    title:"EI Learning Hub",   desc:"Take smart assessments, read curated articles, and track your emotional growth score over time.", accent:"#ffffff" },
  { id:"journal",     title:"Journaling Module",  desc:"Write private journal entries, reflect on your emotions daily, and unlock motivational quotes.",   accent:"#ffffff" },
  { id:"gamification",title:"Gamification",       desc:"Complete daily missions, earn XP, collect badges and climb the EI journey roadmap.",              accent:"#ffffff" },
  { id:"hr",          title:"HR Management",      desc:"Visualise team emotion trends, filter by department, and schedule HRBP consultations.",            accent:"#ffffff" },
];

function SceneLearning() {
  return (
    <motion.div
      className="w-full h-full flex items-center justify-center"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0 }}
    >
      <img
        src="/scenes/learninghub.png"
        alt="EI Learning Hub"
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.35))" }}
      />
    </motion.div>
  );
}

function SceneJournal() {
  return (
    <motion.div
      className="w-full h-full flex items-center justify-center"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
    >
      <img
        src="/scenes/journal.png"
        alt="Journaling Module"
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.35))" }}
      />
    </motion.div>
  );
}

function SceneGamification() {
  return (
    <motion.div
      className="w-full h-full flex items-center justify-center"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
    >
      <img
        src="/scenes/gamification.png"
        alt="Gamification"
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.35))" }}
      />
    </motion.div>
  );
}

function SceneHR() {
  return (
    <motion.div
      className="w-full h-full flex items-center justify-center"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
    >
      <img
        src="/scenes/hrmanagement.png"
        alt="HR Management"
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.35))" }}
      />
    </motion.div>
  );
}

const SCENE_COMPONENTS = [SceneLearning, SceneJournal, SceneGamification, SceneHR];

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPw, setSignPw] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loginMsg, setLoginMsg] = useState<string|null>(null);
  const [signupMsg, setSignupMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignPw, setShowSignPw] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("IDLE");
  const [inviteHint, setInviteHint] = useState<string|null>(null);
  const debounceRef = useRef<number|null>(null);
  const [scene, setScene] = useState(0);
  const [sceneDir, setSceneDir] = useState(1);

  useEffect(() => {
    const t = setInterval(() => { setSceneDir(1); setScene(p=>(p+1)%SCENES.length); }, 3800);
    return () => clearInterval(t);
  }, []);

  function goScene(idx: number) { setSceneDir(idx>=scene?1:-1); setScene(idx); }

  const isHrLocked = role==="HR"&&(inviteStatus!=="VALID"||!inviteCode.trim());

  const pwRules = useMemo(() => {
    const pw = signPw||"";
    return { minLen:pw.length>=8, upper:/[A-Z]/.test(pw), lower:/[a-z]/.test(pw), number:/[0-9]/.test(pw), symbol:/[^A-Za-z0-9]/.test(pw) };
  }, [signPw]);
  const pwScore = useMemo(()=>Object.values(pwRules).filter(Boolean).length,[pwRules]);
  function pwBarColor() { if(pwScore<=2)return"#ef4444"; if(pwScore<=4)return"#f59e0b"; return"#10b981"; }

  useEffect(() => {
    if(mode!=="signup"||role!=="HR"){setInviteStatus("IDLE");setInviteHint(null);return;}
    const code=inviteCode.trim();
    if(!code){setInviteStatus("IDLE");setInviteHint(null);return;}
    if(debounceRef.current)window.clearTimeout(debounceRef.current);
    debounceRef.current=window.setTimeout(async()=>{
      setInviteStatus("CHECKING");setInviteHint("Checking invite code…");
      try{
        const res=await fetch("/api/auth/validate-hr-invite",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({inviteCode:code})});
        const data=await res.json();
        if(!data.ok){setInviteStatus("INVALID");setInviteHint(data.message||"Wrong HR Invite Code, Retry");return;}
        setInviteStatus("VALID");setInviteHint("Invite verified ✅");
      }catch{setInviteStatus("INVALID");setInviteHint("Could not validate. Try again.");}
    },450);
    return()=>{if(debounceRef.current)window.clearTimeout(debounceRef.current);};
  },[inviteCode,role,mode]);

  async function onLogin(e:React.FormEvent){
    e.preventDefault();setLoginMsg(null);setLoading(true);
    if(!loginEmail.trim()||!loginPw.trim()){setLoginMsg("Please enter your email and password.");setLoading(false);return;}
    const{error}=await supabase.auth.signInWithPassword({email:loginEmail.trim().toLowerCase(),password:loginPw});
    setLoading(false);
    if(error){setLoginMsg(error.message);return;}
    if(!rememberMe){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith("sb-")&&k.includes("-auth-token"))localStorage.removeItem(k);}}catch{/**/}}
    const{data:{user}}=await supabase.auth.getUser();
    const r=user?.user_metadata?.role??"EMPLOYEE";
    if(String(r).toUpperCase()==="ADMIN")router.push("/admin/dashboard");else router.push("/post-login");
  }

  async function onForgotPassword() {
    setLoginMsg(null);
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setLoginMsg("Enter your email first, then click Forgot password?");
      return;
    }
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoginMsg(data.message);
  }

  async function onSignup(e:React.FormEvent){
    e.preventDefault();setSignupMsg(null);
    if(role==="HR"){
      if(!inviteCode.trim()){setSignupMsg("Please enter HR Invite Code.");return;}
      if(inviteStatus==="CHECKING"){setSignupMsg("Please wait, verifying invite code…");return;}
      if(inviteStatus!=="VALID"){setSignupMsg("Wrong HR Invite Code, Retry");return;}
    }
    if(pwScore<5){setSignupMsg("Please meet all password requirements.");return;}
    setLoading(true);
    const res=await fetch("/api/auth/signup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({full_name:fullName,department:role==="EMPLOYEE"?dept:undefined,email:signEmail,password:signPw,role,inviteCode:role==="HR"?inviteCode:undefined})});
    const data=await res.json();setLoading(false);
    if(!data.ok){setSignupMsg(data.message||"Signup failed.");return;}
    setSignupMsg(data.message);
  }

  const formOnLeft=mode==="login";
  const CurrentScene=SCENE_COMPONENTS[scene];
  const currentData=SCENES[scene];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <style jsx global>{`
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes pulse-ring{0%{transform:scale(0.94);opacity:0.5}70%{transform:scale(1.1);opacity:0}100%{transform:scale(0.94);opacity:0}}
        .float-anim{animation:floatY 4.5s ease-in-out infinite}
      `}</style>

      <div className="grid min-h-screen lg:grid-cols-2">

        {/* ── FORM PANEL ── */}
        <div className={["relative flex min-h-screen items-center justify-center px-6 py-12 bg-white",formOnLeft?"lg:order-1":"lg:order-2"].join(" ")}>
          <div className="pointer-events-none absolute inset-0" style={{backgroundImage:"radial-gradient(circle at 10% 20%,rgba(20,184,166,0.05) 0%,transparent 50%),radial-gradient(circle at 90% 80%,rgba(56,189,248,0.05) 0%,transparent 50%)"}}/>
          <AnimatePresence mode="wait">
            <motion.div key={mode}
              initial={{opacity:0,x:mode==="login"?-50:50,rotateY:mode==="login"?-10:10}}
              animate={{opacity:1,x:0,rotateY:0}}
              exit={{opacity:0,x:mode==="login"?50:-50,rotateY:mode==="login"?10:-10}}
              transition={{duration:0.45,ease:"easeInOut"}}
              style={{transformStyle:"preserve-3d"}}
              className="relative w-full max-w-md">
              <button type="button" onClick={()=>router.push("/")} className="flex items-center gap-3 mb-8">
                <div className="grid h-10 w-10 place-items-center rounded-2xl text-white" style={{background:"linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",boxShadow:"0 0 18px rgba(34,211,238,0.4)"}}>
                  <Brain className="h-5 w-5"/>
                </div>
                <span className="text-lg font-extrabold text-slate-900">BrainUp</span>
              </button>
              <h1 className="text-3xl font-extrabold text-slate-900">{mode==="login"?"Welcome back":"Create your account"}</h1>
              <p className="mt-2 text-sm text-slate-500">{mode==="login"?"Login to continue your emotional intelligence journey":"Get started with BrainUp — it's free"}</p>
              <div className="mt-6 flex gap-2 rounded-2xl p-1" style={{background:"rgba(241,245,249,1)",border:"1px solid rgba(226,232,240,1)"}}>
                {(["login","signup"] as const).map(m=>(
                  <button key={m} type="button" onClick={()=>{setMode(m);setLoginMsg(null);setSignupMsg(null);}}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
                    style={{background:mode===m?"#0f172a":"transparent",color:mode===m?"#fff":"#64748b",boxShadow:mode===m?"0 2px 8px rgba(0,0,0,0.18)":"none"}}>
                    {m==="login"?"Login":"Create account"}
                  </button>
                ))}
              </div>
              {(mode==="login"?loginMsg:signupMsg)&&(
                <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{background:"rgba(241,245,249,1)",border:"1px solid rgba(226,232,240,1)",color:"#475569"}}>
                  {mode==="login"?loginMsg:signupMsg}
                </div>
              )}
              {mode==="login"&&(
                <form onSubmit={onLogin} className="mt-6 space-y-4">
                  <Field label="Email"><input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"/></Field>
                  <Field label="Password">
                    <div className="relative">
                      <input type={showLoginPw?"text":"password"} value={loginPw} onChange={e=>setLoginPw(e.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"/>
                      <button type="button" onClick={()=>setShowLoginPw(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">{showLoginPw?<EyeOff size={18}/>:<Eye size={18}/>}</button>
                    </div>
                  </Field>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none"><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300"/>Remember me</label>
                    <button type="button" onClick={onForgotPassword} className="font-semibold text-cyan-600 hover:text-cyan-700 transition">Forgot password?</button>
                  </div>
                  <GradientButton loading={loading} label="Login"/>
                </form>
              )}
              {mode==="signup"&&(
                <form onSubmit={onSignup} className="mt-6 space-y-4">
                  <Field label="Select your role">
                    <div className="flex gap-2">
                      {(["EMPLOYEE","HR"] as Role[]).map(r=>(
                        <button key={r} type="button" onClick={()=>{setRole(r);setInviteCode("");setInviteStatus("IDLE");setInviteHint(null);setSignupMsg(null);}}
                          className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition-all"
                          style={{borderColor:role===r?"#22d3ee":"#e2e8f0",background:role===r?"rgba(236,254,255,1)":"#fff",color:role===r?"#0e7490":"#64748b"}}>
                          {r==="EMPLOYEE"?"Employee":"HR Manager"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {role==="HR"&&(
                    <Field label="HR Invite Code">
                      <input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="Enter invite code" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"/>
                      {inviteHint&&<p className="mt-1.5 text-xs font-semibold" style={{color:inviteStatus==="VALID"?"#059669":inviteStatus==="INVALID"?"#dc2626":"#64748b"}}>{inviteHint}</p>}
                    </Field>
                  )}
                  <Field label="Full Name"><input disabled={isHrLocked} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="John Doe" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50 disabled:text-slate-400"/></Field>
                  <Field label="Work Email"><input disabled={isHrLocked} value={signEmail} onChange={e=>setSignEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50 disabled:text-slate-400"/></Field>
                  {role==="EMPLOYEE"&&<Field label="Department"><input value={dept} onChange={e=>setDept(e.target.value)} placeholder="e.g. Engineering, Marketing" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"/></Field>}
                  <Field label="Password">
                    <div className="relative">
                      <input disabled={isHrLocked} type={showSignPw?"text":"password"} value={signPw} onChange={e=>setSignPw(e.target.value)} placeholder="Create a strong password" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50 disabled:text-slate-400"/>
                      <button type="button" onClick={()=>setShowSignPw(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">{showSignPw?<EyeOff size={18}/>:<Eye size={18}/>}</button>
                    </div>
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-300" style={{width:`${(pwScore/5)*100}%`,background:pwBarColor()}}/></div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        {[{ok:pwRules.minLen,text:"Min 8 characters"},{ok:pwRules.upper,text:"Uppercase (A-Z)"},{ok:pwRules.lower,text:"Lowercase (a-z)"},{ok:pwRules.number,text:"Number (0-9)"},{ok:pwRules.symbol,text:"Symbol (!@#$…)"}].map(r=>(
                          <div key={r.text} className="flex items-center gap-1.5 text-xs" style={{color:r.ok?"#059669":"#94a3b8"}}><CheckCircle2 size={11}/>{r.text}</div>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <GradientButton loading={loading||isHrLocked} label="Create Account"/>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── TEAL PANEL ── */}
        <div
          className={["relative hidden lg:flex flex-col items-center justify-center overflow-hidden",formOnLeft?"lg:order-2":"lg:order-1"].join(" ")}
          style={{background:"linear-gradient(145deg,#0d9488 0%,#0891b2 50%,#0c4a6e 100%)",minHeight:"100vh"}}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.032]" style={{backgroundImage:"repeating-linear-gradient(45deg,#fff 0px,#fff 1px,transparent 1px,transparent 36px)"}}/>
          <div className="pointer-events-none absolute inset-0" style={{backgroundImage:"radial-gradient(ellipse 80% 60% at 20% 15%,rgba(255,255,255,0.13) 0%,transparent 60%),radial-gradient(ellipse 60% 70% at 80% 85%,rgba(255,255,255,0.07) 0%,transparent 55%)"}}/>
          <div className="pointer-events-none absolute rounded-full"
            style={{width:380,height:380,filter:"blur(90px)",top:"15%",left:"10%",background:"rgba(255,255,255,0.06)"}}/>
          {[...Array(10)].map((_,i)=>(
            <motion.div key={i} className="pointer-events-none absolute rounded-full"
              style={{width:3+(i%3)*3,height:3+(i%3)*3,background:`rgba(255,255,255,${0.1+(i%4)*0.05})`,left:`${8+i*9}%`,top:`${10+(i%5)*17}%`}}
              animate={{y:[0,-18,0],opacity:[0.2,0.7,0.2]}} transition={{duration:3+i*0.5,repeat:Infinity,ease:"easeInOut",delay:i*0.28}}/>
          ))}

          <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8 py-10">
            <div className="flex items-center gap-2.5 mb-6 self-start">
              <div className="float-anim grid h-9 w-9 place-items-center rounded-xl text-white relative" style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.35)",backdropFilter:"blur(8px)"}}>
                <div className="absolute inset-0 rounded-xl" style={{animation:"pulse-ring 2.8s ease-out infinite"}}/>
                <Brain className="h-4 w-4 relative z-10"/>
              </div>
              <span className="text-base font-extrabold text-white tracking-tight">BrainUp</span>
            </div>

            <div className="relative w-full rounded-3xl overflow-hidden"
              style={{height:"290px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",backdropFilter:"blur(12px)",boxShadow:"0 16px 48px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.15)"}}>
              <div className="absolute top-0 left-0 right-0 h-[3px]"
                style={{background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)"}}/>
              <AnimatePresence mode="wait" custom={sceneDir}>
                <motion.div key={scene} custom={sceneDir}
                  variants={{enter:(d:number)=>({opacity:0,x:d*55}),center:{opacity:1,x:0},exit:(d:number)=>({opacity:0,x:d*-55})}}
                  initial="enter" animate="center" exit="exit"
                  transition={{duration:0.42,ease:"easeInOut"}}
                  className="absolute inset-0 p-3">
                  <CurrentScene/>
                </motion.div>
              </AnimatePresence>
              <button type="button" onClick={()=>goScene((scene-1+SCENES.length)%SCENES.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full transition-all hover:scale-110 active:scale-95"
                style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)"}}>
                <ChevronLeft className="h-4 w-4 text-white"/>
              </button>
              <button type="button" onClick={()=>goScene((scene+1)%SCENES.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full transition-all hover:scale-110 active:scale-95"
                style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)"}}>
                <ChevronRight className="h-4 w-4 text-white"/>
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={`txt-${scene}`} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.38,ease:"easeOut"}} className="mt-5 text-center w-full">
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <div className="h-2 w-2 rounded-full bg-white"/>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/55">Feature Spotlight</span>
                </div>
                <h3 className="text-xl font-extrabold text-white leading-snug">{currentData.title}</h3>
                <p className="mt-1.5 text-sm text-white/60 leading-relaxed max-w-xs mx-auto">{currentData.desc}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex items-center gap-2">
              {SCENES.map((_,i)=>(
                <button key={i} type="button" onClick={()=>goScene(i)} className="transition-all duration-300 rounded-full"
                  style={{width:scene===i?26:8,height:8,background:scene===i?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.28)",border:"none",cursor:"pointer"}}/>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0"/>
              <span className="text-[11px] font-semibold text-white/45">Designed for Malaysian SMEs · Built for real EI growth</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <div><label className="mb-1.5 block text-sm font-bold text-slate-700">{label}</label>{children}</div>;
}

function GradientButton({loading,label}:{loading:boolean;label:string}) {
  return (
    <button disabled={loading} className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-extrabold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-60"
      style={{background:"linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8)",boxShadow:"0 4px 16px rgba(34,211,238,0.38)"}}>
      {loading?<span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"/>:<>{label}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"/></>}
    </button>
  );
}