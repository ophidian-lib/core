import { defineConfig } from 'tsup';
import inline from "esbuild-plugin-inline-import";
import { dirname } from "path";
import * as sass from "sass";

export default defineConfig({
    entry: ["src/index.ts"],
    sourcemap: true,
    format: ["esm"],
    treeshake: true,
    dts: {
        entry: "src/index.ts",
        // https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/#simplified-reference-directive-declaration-emit
        banner: `/// <reference path="../src/augments.d.ts" preserve="true" />`,
    },
    external: ["uneventful"],
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
