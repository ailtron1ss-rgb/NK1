import { isAbsolute } from 'node:path';
import { FileStateStore } from '../../persistence/FileStateStore.ts';
import {
  PluginMessageIngress,
  type PluginMessageIngressOptions,
  type PluginMessageIngressSnapshot,
} from './PluginMessageIngress.ts';

/**
 * Host bootstrap for a production N.E.K.O. message ingress.
 *
 * The returned instance is already restored. The transport must not begin
 * accepting messages until this promise resolves successfully.
 */
export interface FileBackedPluginMessageIngressOptions
  extends Omit<PluginMessageIngressOptions, 'receiptStore'> {
  receiptFilePath: string;
}

export async function createFileBackedPluginMessageIngress(
  options: FileBackedPluginMessageIngressOptions,
): Promise<PluginMessageIngress> {
  if (!options || typeof options.receiptFilePath !== 'string' ||
      options.receiptFilePath.trim() !== options.receiptFilePath ||
      options.receiptFilePath.length === 0 || !isAbsolute(options.receiptFilePath)) {
    throw new Error('neko-message-ingress-receipt-path-must-be-absolute');
  }

  const { receiptFilePath, ...ingressOptions } = options;
  const receiptStore = new FileStateStore<PluginMessageIngressSnapshot>(receiptFilePath);
  const ingress = new PluginMessageIngress({ ...ingressOptions, receiptStore });

  // Restore is part of construction: callers cannot accidentally open their
  // transport with an empty in-memory replay cache after a process restart.
  await ingress.initialize();
  return ingress;
}
