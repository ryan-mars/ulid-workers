// must use require()
const nodeCrypto = require("crypto");
const sinon = require("sinon");

import { expect } from "chai";
import { decodeTime, ulidFactory } from "../src/index";
import { exportedForTesting } from "../src/ulid";

const { encodeRandom, encodeTime, randomChar, validateTimestamp, webCryptoPRNG } =
    exportedForTesting;

describe("ulid", function () {
    before(function () {
        // Web Crypto, specifically crypto.getRandomValues is not available in
        // Node.js. Stub out getRandomValues() using node crypto for local tests.
        // @ts-ignore-next-line
        global.crypto = {
            getRandomValues: function (buf) {
                if (!(buf instanceof Uint8Array)) {
                    throw new TypeError("expected Uint8Array");
                }
                const bytes = nodeCrypto.randomBytes(buf.length);
                buf.set(bytes);
                return buf;
            },
        };
    });

    describe("decodeTime", function () {
        it("should return correct timestamp", function () {
            const timestamp = Date.now();
            const ulid = ulidFactory({ monotonic: false });
            const id = ulid(timestamp);
            expect(decodeTime(id)).to.equal(timestamp);
        });

        // https://github.com/ulid/spec
        it("should return correct timestamp for README example", function () {
            const id = "01ARYZ6S41TSV4RRFFQ69G5FAV";
            expect(decodeTime(id)).to.equal(1469918176385);
        });

        it("should accept the maximum allowed timestamp", function () {
            expect(decodeTime("7ZZZZZZZZZZZZZZZZZZZZZZZZZ")).to.equal(281474976710655);
        });

        describe("should reject", function () {
            it("malformed strings of incorrect length", function () {
                expect(() => {
                    decodeTime("FFFF");
                }).to.throw(/Malformed ULID/);
            });

            it("strings with timestamps that are too high", function () {
                expect(() => {
                    decodeTime("80000000000000000000000000");
                }).to.throw(/Malformed ULID: timestamp too large/);
            });
        });
    });

    describe("encodeRandom", function () {
        it("should return correct length", function () {
            expect(encodeRandom(12)).to.have.a.lengthOf(12);
        });
    });

    describe("encodeTime", function () {
        it("should return expected encoded result", function () {
            expect(encodeTime(1469918176385, 10)).to.equal("01ARYZ6S41");
        });

        it("should change length properly", function () {
            expect(encodeTime(1470264322240, 12)).to.equal("0001AS99AA60");
        });

        it("should truncate time if not enough length", function () {
            expect(encodeTime(1470118279201, 8)).to.equal("AS4Y1E11");
        });

        describe("should throw an error", function () {
            it("if validateTimestamp is being called", function () {
                expect(() => {
                    encodeTime(Math.pow(2, 48), 8);
                }).to.throw(/cannot encode a timestamp larger than/);
            });
        });
    });

    describe("validateTimestamp", function () {
        it("should return nothing for a valid timestamp", function () {
            expect(validateTimestamp(Date.now())).to.equal(undefined);
        });

        describe("should throw an error", function () {
            it("if time greater than (2 ^ 48) - 1", function () {
                expect(() => {
                    validateTimestamp(Math.pow(2, 48));
                }).to.throw(/cannot encode a timestamp larger than/);
            });

            it("if time is not a number", function () {
                expect(() => {
                    //@ts-ignore
                    validateTimestamp("test");
                    //@ts-check
                }).to.throw(/timestamp must be a number/);
            });

            it("if time is infinity", function () {
                expect(() => {
                    validateTimestamp(Infinity);
                }).to.throw(/cannot encode a timestamp larger than/);
            });

            it("if time is negative", function () {
                expect(() => {
                    validateTimestamp(-1);
                }).to.throw(/timestamp must be positive/);
            });

            it("if time is a float", function () {
                expect(() => {
                    validateTimestamp(100.1);
                }).to.throw(/timestamp must be an integer/);
            });
        });
    });

    describe("randomChar", function () {
        it("should never return undefined or an empty string", function () {
            for (let x = 0; x < 10000; x++) {
                const randChar = randomChar();
                expect(randChar).to.not.be.undefined;
                expect(randChar).to.not.equal("");
            }
        });
    });

    describe("ulidFactory", function () {
        it("outputs a function with no args", function () {
            expect(ulidFactory()).to.be.a("function");
        });

        it("outputs a function with monotonic false", function () {
            expect(ulidFactory({ monotonic: false })).to.be.a("function");
        });

        it("outputs a function with monotonic true", function () {
            expect(ulidFactory({ monotonic: true })).to.be.a("function");
        });
    });

    describe("ulid non-monotonic", function () {
        before(function () {
            // Stub out web crypto.getRandomValues() to always return the same value
            // @ts-ignore-next-line
            global.crypto = {
                getRandomValues: function (buf) {
                    if (!(buf instanceof Uint8Array)) {
                        throw new TypeError("expected Uint8Array");
                    }
                    const zeroBytes = Buffer.alloc(buf.length); // zero-filled Buffer of the correct length for these tests
                    buf.set(zeroBytes);
                    return buf;
                },
            };

            this.ulid = ulidFactory({ monotonic: false });
        });

        it("should return correct length", function () {
            expect(this.ulid()).to.have.a.lengthOf(26);
        });

        describe("with seedTime", function () {
            it("should return expected encoded time component result", function () {
                expect(this.ulid(1469918176385).substring(0, 10)).to.equal("01ARYZ6S41");
            });

            it("should always return the same value when time and randomness are frozen", function () {
                // both time seed and the random component are frozen for this test
                for (let x = 0; x < 10; x++) {
                    expect(this.ulid(164436145)).to.equal("00004WT65H0000000000000000");
                }
            });

            describe("should throw an error", function () {
                it("if validateTimestamp is being called", function () {
                    expect(() => {
                        encodeTime(Math.pow(2, 48), 8);
                    }).to.throw(/cannot encode a timestamp larger than/);
                });
            });
        });

        describe("without seedTime", function () {
            before(function () {
                this.clock = sinon.useFakeTimers({
                    now: 1469918176385,
                    toFake: ["Date"],
                });
            });

            after(function () {
                this.clock.restore();
            });

            it("should always return the same value", function () {
                // both time and the random component are frozen for this test
                for (let x = 0; x < 10; x++) {
                    expect(this.ulid()).to.equal("01ARYZ6S410000000000000000");
                }
            });
        });
    });

    describe("ulid monotonic", function () {
        before(function () {
            // Stub out web crypto.getRandomValues() to always return the same value
            // @ts-ignore-next-line
            global.crypto = {
                getRandomValues: function (buf) {
                    if (!(buf instanceof Uint8Array)) {
                        throw new TypeError("expected Uint8Array");
                    }
                    const zeroBytes = Buffer.alloc(buf.length); // zero-filled Buffer of the correct length for these tests
                    buf.set(zeroBytes);
                    return buf;
                },
            };
        });

        it("should return correct length", function () {
            const ulid = ulidFactory({ monotonic: true });
            expect(ulid()).to.have.a.lengthOf(26);
        });

        describe("with seedTime", function () {
            before(function () {
                this.ulid = ulidFactory({ monotonic: true });
            });

            it("first call", function () {
                expect(this.ulid(164436145)).to.equal("00004WT65H0000000000000000");
            });

            it("second call", function () {
                expect(this.ulid(164436145)).to.equal("00004WT65H0000000000000001");
            });

            it("third call", function () {
                expect(this.ulid(164436145)).to.equal("00004WT65H0000000000000002");
            });

            it("fourth call", function () {
                expect(this.ulid(164436145)).to.equal("00004WT65H0000000000000003");
            });

            describe("should throw an error", function () {
                it("if validateTimestamp is being called", function () {
                    expect(() => {
                        encodeTime(Math.pow(2, 48), 8);
                    }).to.throw(/cannot encode a timestamp larger than/);
                });
            });
        });

        describe("without seedTime", function () {
            before(function () {
                this.clock = sinon.useFakeTimers({
                    now: 1469918176385,
                    toFake: ["Date"],
                });
            });

            before(function () {
                this.ulid = ulidFactory({ monotonic: true });
            });

            after(function () {
                this.clock.restore();
            });

            it("first call", function () {
                expect(this.ulid()).to.equal("01ARYZ6S410000000000000000");
            });

            it("second call", function () {
                expect(this.ulid()).to.equal("01ARYZ6S410000000000000001");
            });

            it("third call", function () {
                expect(this.ulid()).to.equal("01ARYZ6S410000000000000002");
            });

            it("fourth call", function () {
                expect(this.ulid()).to.equal("01ARYZ6S410000000000000003");
            });
        });
    });

    describe("webCryptoPRNG", function () {
        it("should return a function", function () {
            expect(webCryptoPRNG).to.be.a("function");
        });

        describe("returned function", function () {
            it("should produce a number", function () {
                expect(webCryptoPRNG()).to.be.a("number");
                expect(webCryptoPRNG()).to.satisfy((num) => !isNaN(num));
            });

            it("should be between 0 and 1", function () {
                expect(webCryptoPRNG()).to.satisfy((num) => num >= 0 && num <= 1);
            });
        });
    });
});
