import type { WillIntegrationBridge, WillTransportEnvelope } from './WillIntegrationBridge.ts';

export type WillChannelKind='discord'|'whatsapp'|'telegram'|'http'|'mcp'|'generic';
export interface WillChannelBridgeApi {
  enqueue(input:Parameters<WillIntegrationBridge['enqueue']>[0]):ReturnType<WillIntegrationBridge['enqueue']>;
  ack(input:Parameters<WillIntegrationBridge['ack']>[0]):ReturnType<WillIntegrationBridge['ack']>;
}
export interface ChannelInbound { channel:WillChannelKind; externalId:string; from:string; text:string; threadId?:string; at?:number; metadata?:Record<string,unknown>; }

import { sha256Stable } from '../../core/StableSerialization.ts';

const deterministicId=(prefix:string,payload:unknown)=>`${prefix}:${sha256Stable(payload).slice(0,24)}`;

export class WillChannelAdapter {
  private readonly bridge:WillChannelBridgeApi;
  private readonly sourcePrefix:string;
  constructor(bridge:WillChannelBridgeApi, sourcePrefix='channel'){ this.bridge=bridge; this.sourcePrefix=sourcePrefix; }
  inbound(input:ChannelInbound):WillTransportEnvelope{
    const id=`${this.sourcePrefix}:${input.channel}:${input.externalId}`;
    return this.bridge.enqueue({id,type:`${input.channel}.message`,source:input.from,payload:{...input,text:input.text},createdAt:input.at??Date.now()});
  }
  outbound(channel:WillChannelKind,externalTarget:string,payload:unknown,correlationId?:string){
    const body={channel,target:externalTarget,payload,correlationId:correlationId??null};
    return this.bridge.enqueue({id:deterministicId(`${this.sourcePrefix}:${channel}:out`,body),type:`${channel}.outbound`,source:'neuro-kurisu',payload:{target:externalTarget,payload},correlationId});
  }
  ackExternal(envelopeId:string,accepted=true,reason?:string){ return this.bridge.ack({envelopeId,accepted,at:Date.now(),reason}); }
}
