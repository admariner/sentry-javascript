import { getCurrentHub } from '@sentry/core';

import { ReplayContainer } from '../../src/replay';
import { BASE_TIMESTAMP, RecordMock } from './../index';
import { DomHandler, MockTransportSend } from './../types';
import { MockSdkParams } from './mockSdk';

export async function resetSdkMock({ replayOptions, sentryOptions }: MockSdkParams): Promise<{
  domHandler: DomHandler;
  mockRecord: RecordMock;
  mockTransportSend: MockTransportSend;
  replay: ReplayContainer;
  spyCaptureException: jest.SpyInstance;
}> {
  let domHandler: DomHandler;

  jest.setSystemTime(new Date(BASE_TIMESTAMP));
  jest.clearAllMocks();
  jest.resetModules();
  // NOTE: The listeners added to `addInstrumentationHandler` are leaking
  // @ts-ignore Don't know if there's a cleaner way to clean up old event processors
  globalThis.__SENTRY__.globalEventProcessors = [];
  const SentryUtils = await import('@sentry/utils');
  jest.spyOn(SentryUtils, 'addInstrumentationHandler').mockImplementation((type, handler: (args: any) => any) => {
    if (type === 'dom') {
      domHandler = handler;
    }
  });
  const { mockRrweb } = await import('./mockRrweb');
  const { record: mockRecord } = mockRrweb();

  // Because of `resetModules`, we need to import and add a spy for
  // `@sentry/core` here before `mockSdk` is called
  // XXX: This is probably going to make writing future tests difficult and/or
  // bloat this area of code
  const SentryCore = await import('@sentry/core');
  const spyCaptureException = jest.spyOn(SentryCore, 'captureException');

  const { mockSdk } = await import('./mockSdk');
  const { replay } = await mockSdk({
    replayOptions,
    sentryOptions,
  });

  const mockTransportSend = getCurrentHub()?.getClient()?.getTransport()?.send as MockTransportSend;

  // XXX: This is needed to ensure `domHandler` is set
  jest.runAllTimers();
  await new Promise(process.nextTick);
  jest.setSystemTime(new Date(BASE_TIMESTAMP));

  return {
    // @ts-ignore use before assign
    domHandler,
    mockRecord,
    mockTransportSend,
    replay,
    spyCaptureException,
  };
}
