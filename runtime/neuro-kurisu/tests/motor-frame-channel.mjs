import assert from "node:assert/strict";
import test from "node:test";
import { MotorFrameChannel, validateMotorFrameForTransport } from "../src/organism/system/MotorFrameChannel.ts";

const frame = (tick=1, atMs=tick*16) => ({
  version:1, tick, atMs, goalId:"goal.avatar.01", action:"explain", phase:"moving",
  joints:{head:{id:"head",angleRad:.1,targetAngleRad:.4,velocityRadPerSec:.2,accelerationRadPerSec2:.5,available:true}},
  reachedJointIds:[], blockedJointIds:[], completion01:.4, reason:"bounded-motion",
});

test("accepts a valid frame and returns defensive snapshots",()=>{
 const channel=new MotorFrameChannel();
 assert.deepEqual(channel.publish(frame()),{accepted:true,reason:"frame-published"});
 const read=channel.readLatest(); assert.equal(read.joints.head.angleRad,.1);
 read.joints.head.angleRad=99; read.reachedJointIds.push("head");
 assert.equal(channel.readLatest().joints.head.angleRad,.1);
 assert.deepEqual(channel.readLatest().reachedJointIds,[]);
});

test("rejects stale ticks, rewound time and malformed joint state",()=>{
 const channel=new MotorFrameChannel(); channel.publish(frame(3,50));
 assert.equal(channel.publish(frame(3,51)).reason,"frame-tick-not-increasing");
 assert.equal(channel.publish(frame(4,49)).reason,"frame-time-rewound");
 const bad=frame(4,60); bad.joints.head.angleRad=Infinity;
 assert.equal(channel.publish(bad).reason,"invalid-frame-joint-numeric-state");
 assert.equal(channel.readLatest().tick,3);
 assert.equal(channel.diagnostics().rejected,3);
});

test("rejects invalid envelope, status references and oversized skeletons",()=>{
 assert.equal(validateMotorFrameForTransport(null).reason,"frame-not-object");
 const bad=frame(); bad.blockedJointIds=["missing"];
 assert.equal(validateMotorFrameForTransport(bad).reason,"invalid-frame-joint-status-list");
 const many=frame(); many.joints={a:{id:"a",angleRad:0,targetAngleRad:0,velocityRadPerSec:0,accelerationRadPerSec2:0,available:true},b:{id:"b",angleRad:0,targetAngleRad:0,velocityRadPerSec:0,accelerationRadPerSec2:0,available:true}};
 assert.equal(validateMotorFrameForTransport(many,1).reason,"frame-joint-count-exceeded");
});

test("publishes only the latest frame and subscribers receive isolated copies",()=>{
 const channel=new MotorFrameChannel(); const seen=[];
 channel.subscribe(value=>{seen.push(value.tick);value.joints.head.angleRad=77;});
 channel.publish(frame(1,10)); channel.publish(frame(2,20));
 assert.deepEqual(seen,[1,2]); assert.equal(channel.readLatest().joints.head.angleRad,.1);
 assert.equal(channel.diagnostics().hasLatest,true);
});

test("isolates listener exceptions and supports idempotent disposal",()=>{
 const channel=new MotorFrameChannel(); let calls=0;
 channel.subscribe(()=>{throw new Error("renderer-failed");});
 const dispose=channel.subscribe(()=>calls++);
 channel.publish(frame()); dispose(); dispose(); channel.publish(frame(2,32));
 assert.equal(calls,1); assert.equal(channel.diagnostics().listenerErrors,2);
 assert.equal(channel.diagnostics().listenerCount,1);
});

test("replay is explicit and listener capacity is bounded",()=>{
 const channel=new MotorFrameChannel({maxListeners:1}); channel.publish(frame());
 let replayed=0; channel.subscribe(()=>replayed++,true); assert.equal(replayed,1);
 assert.throws(()=>channel.subscribe(()=>{}),/capacity/);
});

test("clear removes latest state but preserves monotonic publication history counters",()=>{
 const channel=new MotorFrameChannel(); channel.publish(frame()); channel.clear();
 assert.equal(channel.readLatest(),null); assert.equal(channel.diagnostics().hasLatest,false);
 assert.equal(channel.diagnostics().published,1); assert.equal(channel.diagnostics().lastTick,null);
});
