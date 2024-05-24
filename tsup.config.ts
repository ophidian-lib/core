import { defineConfig } from 'tsup';
import inline from "esbuild-plugin-inline-import";
import { dirname } from "path";
import * as sass from "sass";

export default defineConfig({
    entry: ["src/index.ts"],
    sourcemap: true,
    format: ["esm"],
    treeshake: true,
    dts: true,
    clean: true,
    esbuildPlugins: [
        inline({filter: /^text:/}),
        inline({filter: /^scss:/, transform(data, args) {
            return new Promise((resolve, reject) => {
                sass.render({data, includePaths: [dirname(args.path)]}, (err, result) => {
                    if (err) return reject(err);
                    resolve(result.css.toString());
                });
            });
        }}),
    ],
})