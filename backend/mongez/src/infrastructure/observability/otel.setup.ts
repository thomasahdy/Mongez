import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// For debugging telemetry issues, console logging can be enabled
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Avoid excessive span generation from raw filesystem access
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-net': {
        enabled: false,
      },
    }),
  ],
});

console.log('OpenTelemetry disabled for testing');
// try {
//   sdk.start();
//   console.log('OpenTelemetry Tracing initialized successfully.');
// } catch (error) {
//   console.error('Error initializing OpenTelemetry Tracing:', error);
// }
// Gracefully shut down telemetry SDK on process termination
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('OpenTelemetry Tracing terminated.'))
    .catch((err) => console.error('Error terminating OpenTelemetry Tracing:', err))
    .finally(() => process.exit(0));
});

export default sdk;
