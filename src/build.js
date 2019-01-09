import path from "path"
import fs from "fs-extra"
import {empSync} from "emp"
import jsYaml from "js-yaml"
import {pick} from "lodash"
import filterObj from "filter-obj"
import chalk from "chalk"
import {countSizeSync} from "list-dir-content-size"
import prettyBytes from "pretty-bytes"
import pkg from "../package.json"
import sortKeys from "sort-keys"

const presets = fs.readdirSync(path.join(__dirname, "presets"))

for (const preset of presets) {
  const {includedDependencies, rules, config, pkg: presetPkg} = require(`./presets/${preset}`).default
  const buildPath = path.resolve(__dirname, "..", "build", preset)
  fs.ensureDirSync(buildPath)
  empSync(buildPath)
  let appliedRules = {}
  for (const rule of rules) {
    const yamlString = fs.readFileSync(path.join(__dirname, "rules", `${rule}.yml`), "utf-8")
    const minifiedYamlString = yamlString
      .replace(/OFF/g, 0)
      .replace(/WARN/g, 1)
      .replace(/ERROR/g, 2)
    const loadedRules = jsYaml.safeLoad(minifiedYamlString)
    Object.assign(appliedRules, loadedRules)
  }
  const eslintConfig = {
    ...config,
    rules: appliedRules |> sortKeys
  } |> sortKeys
  fs.outputJsonSync(path.join(buildPath, "index.json"), eslintConfig)
  const dependencies = filterObj(pkg.dependencies, key => includedDependencies.includes(key))
  const generatedPkg = {
    ...pick(pkg, ["license", "version", "author", "repository", "peerDependencies"]),
    ...presetPkg,
    dependencies: dependencies |> sortKeys,
    main: "index.json"
  } |> sortKeys
  fs.outputJsonSync(path.join(buildPath, "package.json"), generatedPkg)
  fs.copyFileSync(path.join(__dirname, "..", "license.txt"), path.join(buildPath, "license.txt"))
  fs.copyFileSync(path.join(__dirname, "..", "readme.md"), path.join(buildPath, "readme.md"))
  console.log(`${chalk.green(presetPkg.name)} ${prettyBytes(countSizeSync(buildPath))}`)
}