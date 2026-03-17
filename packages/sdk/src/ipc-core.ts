export {
  defineContract,
  defineEvent,
  defineStream,
  createClient,
  createEventClient,
  createStreamClient,
  getInvokeChannels,
  getReceiveChannels,
  getStreamChannels,
} from "../../../src/ipc/contracts/core";

export type {
  IpcContract,
  EventContract,
  StreamContract,
  ContractInput,
  ContractOutput,
  ContractChannel,
  EventPayload,
  EventChannel,
} from "../../../src/ipc/contracts/core";
