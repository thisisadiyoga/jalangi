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

if (typeof window === "undefined") {
    require('../../src/js/InputManager');
    require(process.cwd()+'/inputs');
}

function whatDoIExpect(s) {
    var j = s.lastIndexOf("sun");
    var i = s.indexOf("am")
    if (i >= 0) {
        if (j > 0) {
            if (i + 2  === j) {
                s = s+ "g";
                s = "S"+s;
                console.log("What is s? "+s);
            }
        }
    }
}


whatDoIExpect($7.readInput(""));

