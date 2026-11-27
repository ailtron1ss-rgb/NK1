/** Host-signed observation admission. Implementation is introduced after its RED regression. */
export interface TrustedObservationAdmission {
  observationId:string;
  at:number;
  modality:'text'|'vision'|'audio'|'sensor'|'world'|'fusion';
  claim:string;
  confidence01:number;
  deviceId:string;
  sessionId:string;
  consentTicketId:string;
  consentRevision:number;
  captureDigest:string;
  receiptDigest:string;
  issuerId:string;
}
export function isTrustedObservationAdmission(_value:unknown):_value is TrustedObservationAdmission{return false;}
export type ObservationAdmissionResult={accepted:true;admission:TrustedObservationAdmission}|{accepted:false;reason:string};
export class SignedObservationAdmissionAuthority {
  constructor(_config:unknown){}
  async admit(_receipt:unknown):Promise<ObservationAdmissionResult>{return {accepted:false,reason:'not-implemented'};}
}
