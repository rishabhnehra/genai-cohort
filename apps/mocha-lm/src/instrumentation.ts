/**
 * Next.js instrumentation hook. Must live under `src/` when the app uses a
 * `src/` directory — standalone Docker builds often ignore a root-level
 * `instrumentation.ts`, which left the ingestion worker unstarted in prod.
 */
export async function register() {
  console.log(`From register(), ${process.env.NEXT_RUNTIME}`);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startIngestionWorker } = await import("./worker");
      await startIngestionWorker({ exitOnFailure: false });
    } catch (error) {
      console.error(
        "ingestion worker failed to start (web server will continue)",
        error,
      );
    }
  }
}
