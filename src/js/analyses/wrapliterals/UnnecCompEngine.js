// Author: Michael Pradel

(function (sandbox) {
    function UnnecCompEngine(executionIndex) {
        var ConcolicValue = require('./../../ConcolicValue');
        var getConcrete = this.getConcrete = ConcolicValue.getConcrete;
        var getSymbolic = this.getSymbolic = ConcolicValue.getSymbolic;

        if (!(this instanceof UnnecCompEngine)) {
            return new UnnecCompEngine(executionIndex);
        }

        this.literal = function (iid, val) {
            var val_s = getSymbolic(val);
            if (val_s) {
                return val;
            } else {
                var depNode = new DepNode(iid);
                return new ConcolicValue(val, depNode);
            }
        };
    }

    function DepNode(iid) {
        this.toString = function () {
            return "" + iid;
        }
    }

    module.exports = UnnecCompEngine;
}(J$));