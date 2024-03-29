import { glob } from "glob";
import Mocha from "mocha";
import path from "path";

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
  });
  mocha.timeout(100000);

  const testsRoot = __dirname;
  const testFile = process.env.testFile;
  const pattern = testFile
    ? path.join(...testFile.replace(/\.ts$/, ".js").split(path.sep).slice(2))
    : "**/**.test.js";

  return new Promise(async (resolve, reject) => {
    const results = await glob(pattern, { cwd: testsRoot });

    // Add files to the test suite
    results.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
