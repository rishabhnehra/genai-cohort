export async function register() {
  console.log(`From register(), ${process.env.NEXT_RUNTIME}`);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./src/worker");
  }
}
