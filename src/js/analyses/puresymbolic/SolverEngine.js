/*
 * Copyright 2013 Samsung Information Systems America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Author: Koushik Sen

//------------------------------------- Generate SMT formula and solve and write to input file -------------

(function(module){

    function SolverEngine() {
        var fs = require('fs');
        var FileLineReader = require('./../../utils/FileLineReader');
        var PREFIX1 = "$7";
        var FORMULA_FILE_NAME = "jalangi_formula";
        var SOLUTION_FILE_NAME = "jalangi_solution";
        var INPUTS_FILE_NAME = "jalangi_inputs";
        var TAIL_FILE_NAME = "jalangi_tail";

        var SymbolicBool = require('../concolic/SymbolicBool');

        function execSync(cmd) {
            var FFI = require("node-ffi");
            var libc = new FFI.Library(null, {
                "system": ["int32", ["string"]]
            });

            var run = libc.system;
            run(cmd);
        }

        function HOP(obj, prop) {
            return Object.prototype.hasOwnProperty.call(obj, prop);
        }


        function generateFormula(formula, mode, assignments, extra) {
            var freeVars = {}, f;

            f = formula.substitute(assignments).getFormulaString(freeVars, mode, assignments);
            if (f.trim() === "(TRUE)") {
                return true;
            }


            var formulaFh = fs.openSync(FORMULA_FILE_NAME+mode, 'w');
            for (var key in freeVars) {
                if (HOP(freeVars,key)) {
                    fs.writeSync(formulaFh, key +" : INT;\n");
                }
            }

            if (extra) {
                fs.writeSync(formulaFh,"ASSERT ");
                fs.writeSync(formulaFh, extra);
                fs.writeSync(formulaFh,";\n");
            }

            fs.writeSync(formulaFh,"CHECKSAT ");
            fs.writeSync(formulaFh,f);
            fs.writeSync(formulaFh,";\n");
            fs.writeSync(formulaFh,"COUNTERMODEL;\n");
            fs.closeSync(formulaFh);
            return false;
        }

        function invokeSMTSolver(newInputs, mode) {
            execSync(require('path').resolve(__dirname)+"/../../../../thirdparty/cvc3/bin/cvc3 < "+FORMULA_FILE_NAME+mode+" > "+SOLUTION_FILE_NAME+mode);
            return parseInputs(newInputs, mode);
        }

        function parseInputs(newInputs, mode) {
            var fd, line, tokens, key, tmp, val;
            var negatedSolution = null;

            fd = new FileLineReader(SOLUTION_FILE_NAME+mode);

            if (fd.hasNextLine()) {
                line = fd.nextLine();
                if (line.indexOf("Satisfiable")===0) {
                    while (fd.hasNextLine()) {
                        line = fd.nextLine();
                        if (line.indexOf("ASSERT")===0) {
                            if (negatedSolution) {
                                negatedSolution += " AND "+line.substring(line.indexOf("("),line.indexOf(")")+1);
                            } else {
                                negatedSolution = line.substring(line.indexOf("("),line.indexOf(")")+1);
                            }
                            tokens = line.split(" ");
                            key = tokens[1].substring(1);
                            tmp = tokens[3];
                            val = parseInt(tmp.substring(0, tmp.indexOf(")")));
                            newInputs[key] = val;
                        }
                    }
                    fd.close();
                    negatedSolution = "(NOT ("+negatedSolution+"))";
                    return negatedSolution;

                }
            }
            fd.close();
            return negatedSolution;
        }

        function constructStringInputs(newInputs) {
            var i, c, len, val, prefix;
            for (var key in newInputs) {
                if (HOP(newInputs, key)) {
                    if (key.indexOf("__length") > 0) {
                        len = newInputs[key];
                        val = "";
                        prefix = key.substring(0, key.indexOf("__length"));
                        for (i=0; i<len; i++) {
                            if ((c = newInputs[prefix+"__"+i]) !== undefined) {
                                val += String.fromCharCode(c);
                            } else {
                                val += "a";
                            }
                        }
                        newInputs[prefix] = val;
                    }
                }
            }
            return newInputs;
        }


        this.writeInputs =  function(currentSolution, inputs, index) {
            var iCount = 0;

            try {
                iCount = JSON.parse(fs.readFileSync(TAIL_FILE_NAME,"utf8"));
            } catch(e) {
                iCount = -1;
            }
            iCount++;

            var fd = fs.openSync(INPUTS_FILE_NAME+iCount, 'w');
            fs.writeSync(fd,PREFIX1+".setCurrentSolutionIndex("+JSON.stringify(index)+");\n");
            fs.writeSync(fd,PREFIX1+".setCurrentSolution("+JSON.stringify(currentSolution)+");\n");
            for (var key in inputs) {
                if (HOP(inputs, key)) {
                        if (key.indexOf("x")>=0 && !(key.indexOf("__") > 0)) {
                            if (HOP(currentSolution, key)) {
                                fs.writeSync(fd,PREFIX1+".setInput(\""+key +"\","+ JSON.stringify(currentSolution[key])+");\n");
                            } else {
                                fs.writeSync(fd,PREFIX1+".setInput(\""+key +"\","+ JSON.stringify(inputs[key])+");\n");
                            }
                        }
                }
            }
            fs.closeSync(fd);

            fs.writeFileSync(TAIL_FILE_NAME,JSON.stringify(iCount),"utf8");
        };

        this.isFeasible = function (formula, newInputs, oldInputs) {
            if (oldInputs) {
                var tmp = {};
                for (var key in oldInputs) {
                    if (HOP(oldInputs, key)) {
                        tmp[key] = oldInputs[key];
                    }
                }
                for (key in newInputs) {
                    if (HOP(newInputs, key)) {
                        tmp[key] = newInputs[key];
                    }
                }
            }
            if (formula.substitute(tmp) === SymbolicBool.true) {
                return true;
            } else {
                return false;
            }
        };


        this.generateInputs = function(formula) {
            var newInputs, count, MAX_COUNT = 100, negatedSolution, extra, allTrue;

            if (formula) {
                    count = 0;
                    extra = null;
                    while(count < MAX_COUNT) {
                        generateFormula(formula, "integer", {}, extra);
                        newInputs = {};
                        if ((negatedSolution = invokeSMTSolver(newInputs, "integer"))) {
                            allTrue = generateFormula(formula, "string", newInputs, null);
                            if (allTrue || invokeSMTSolver(newInputs, "string")) {
                                constructStringInputs(newInputs);
                                if (count > 1) {
                                    console.log("Solved constraint after trial # "+count);
                                }
                                return newInputs;
                            } else {
                                if (extra) {
                                    extra = extra + " AND " + negatedSolution;
                                } else {
                                    extra = negatedSolution;
                                }
                            }
                        } else {
                            return null;
                        }
                        count++;
                    }
            }
            return null;
        };

        this.checkWithConcolicSolver = function (pathConstraint, i) {
            var j;
            var formula;

            for (j=0; j<i; j++) {
                if (j===0) {
                    formula = new SymbolicBool("&&", pathConstraint[j][1], SymbolicBool.true);
                } else {
                    formula = new SymbolicBool("&&", formula, pathConstraint[j][1]);
                }
            }
            if (formula) {
                formula = new SymbolicBool("&&", formula, pathConstraint[j][1].not());
            } else {
                formula = pathConstraint[j][1];
            }
            return this.generateInputs(formula);
        }

    }

    module.exports = SolverEngine;
}(module));


