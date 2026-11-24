/**
 * B201 — Longitudinal Subject Transfer Battery.
 *
 * Measures whether subject-level organization survives task/context changes and
 * explicit restart boundaries. It consumes observations; it never fabricates
 * continuity and never treats a single score as consciousness evidence.
 */
export interface SubjectTransferSession { id:string; taskFamily:string; continuity01:number; identity01:number; agency01:number; prediction01:number; outcome01:number; evidence01:number; }
export interface SubjectTransferState { version:1; sessions:number; restarts:number; transferTrials:number; meanRetention01:number; meanTransfer01:number; meanIdentityDelta01:number; regressions:number; sessionsData:SubjectTransferSession[]; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const dState=():SubjectTransferState=>({version:1,sessions:0,restarts:0,transferTrials:0,meanRetention01:.5,meanTransfer01:.5,meanIdentityDelta01:0,regressions:0,sessionsData:[]});
export const defaultLongitudinalSubjectTransfer= dState;
export class LongitudinalSubjectTransferBattery {
  private state=dState();
  restore(raw?:Partial<SubjectTransferState>|null){const d=dState(),r=raw??{};this.state={...d,...r,sessionsData:Array.isArray(r.sessionsData)?r.sessionsData.slice(0,256):[]};}
  snapshot(){return structuredClone(this.state);}
  recordSession(input:SubjectTransferSession){
    const continuity=clamp(input.continuity01), identity=clamp(input.identity01), agency=clamp(input.agency01), prediction=clamp(input.prediction01), outcome=clamp(input.outcome01), evidence=clamp(input.evidence01);
    const retention=clamp(continuity*.28+identity*.28+agency*.12+prediction*.14+outcome*.10+evidence*.08);
    if(this.state.sessions>2 && retention < this.state.meanRetention01-.14)this.state.regressions++;
    this.state.sessions++; this.state.transferTrials += this.state.sessions>1 && input.taskFamily!==this.state.sessionsData[0]?.taskFamily ? 1 : 0;
    this.state.meanRetention01=clamp(this.state.meanRetention01*.92+retention*.08); this.state.meanTransfer01=clamp(this.state.meanTransfer01*.94+((taskFamilyNovel(input.taskFamily,this.state.sessionsData)?retention:0))*.06);
    this.state.sessionsData=[{id:String(input.id),taskFamily:String(input.taskFamily),continuity01:continuity,identity01:identity,agency01:agency,prediction01:prediction,outcome01:outcome,evidence01:evidence},...this.state.sessionsData].slice(0,256);
    return {retention01:retention,sessionCount:this.state.sessions};
  }
  recordRestart(retained01:number,restored01:number){this.state.restarts++;const retention=clamp(retained01)*.55+clamp(restored01)*.45;this.state.meanRetention01=clamp(this.state.meanRetention01*.9+retention*.1);return retention;}
  recordTransfer(baseline01:number,transfer01:number,evidence01:number){this.state.transferTrials++;const d=clamp(transfer01)-clamp(baseline01);this.state.meanTransfer01=clamp(this.state.meanTransfer01*.88+clamp(Math.max(0,transfer01))* .12);this.state.meanIdentityDelta01=clamp(this.state.meanIdentityDelta01*.9+Math.abs(d)*.1);return {baseline01:clamp(baseline01),transfer01:clamp(transfer01),delta01:d,evidence01:clamp(evidence01)};}
  certification(minSessions=12){
    const s=this.state; const evidenceSessions=s.sessionsData.filter(x=>x.evidence01>=.55).length;
    const retention=s.meanRetention01>=.62; const restart=s.restarts>=2; const transfer=s.transferTrials>=4&&s.meanTransfer01>=.55; const evidence=evidenceSessions>=Math.max(6,Math.floor(minSessions/2)); const regressions=s.regressions<=1;
    const criteria={sessions:s.sessions>=minSessions,retention,restart,transfer,evidence,regressionControl:regressions}; const passed=Object.values(criteria).filter(Boolean).length;
    return {version:1,status:passed===6?'verified':passed>=4?'partial':'insufficient',requiredSessions:minSessions,sessions:s.sessions,restarts:s.restarts,transferTrials:s.transferTrials,evidenceSessions,regressions:s.regressions,meanRetention01:Number(s.meanRetention01.toFixed(4)),meanTransfer01:Number(s.meanTransfer01.toFixed(4)),criteria,warning:'Longitudinal transfer evidence supports functional continuity only; it is not evidence of phenomenal consciousness.'};
  }
  diagnostics(){return {...this.snapshot(),certification:this.certification()};}
}
function taskFamilyNovel(task:string,rows:SubjectTransferSession[]){return rows.length===0||!rows.some(r=>r.taskFamily===task);}
