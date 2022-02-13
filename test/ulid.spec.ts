// must use require()
const nodeCrypto = require("crypto");
const sinon = require("sinon");

import { expect } from "chai";
import { decodeTime, ulidFactory } from "../src/index";
import { exportedForTesting } from "../src/ulid";

const { encodeRandom, encodeTime, incrementBase32, randomChar, validateTimestamp, webCryptoPRNG } =
    exportedForTesting;

const TIME_LEN = 10;
const RANDOM_LEN = 16;
const TEST_ULID = "01ARYZ6S41TSV4RRFFQ69G5FAV";
const TEST_TIME_EPOCH_MS = 1469918176385;
const TEST_TIME_ENCODED = TEST_ULID.substring(0, TIME_LEN);

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
            expect(decodeTime(TEST_ULID)).to.equal(TEST_TIME_EPOCH_MS);
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
            expect(encodeTime(TEST_TIME_EPOCH_MS)).to.equal(TEST_TIME_ENCODED);
        });

        describe("should throw an error", function () {
            it("if validateTimestamp is being called", function () {
                expect(() => {
                    encodeTime(Math.pow(2, 48));
                }).to.throw(/cannot encode a timestamp larger than/);
            });
        });
    });

    describe("incrementBase32", function () {
        it("should return expected result", function () {
            expect(incrementBase32("0".repeat(RANDOM_LEN))).to.equal("0000000000000001");
        });

        it("should return expected result", function () {
            expect(incrementBase32("0000000000000009")).to.equal("000000000000000A");
        });

        it("should return expected result", function () {
            expect(incrementBase32("000000000000000Z")).to.equal("0000000000000010");
        });

        describe("should throw an error", function () {
            it("if Base32 value length > RANDOM_LEN", function () {
                expect(() => {
                    incrementBase32("0".repeat(RANDOM_LEN + 1));
                }).to.throw(/Base32 value to increment cannot be longer than 16/);
            });

            it("if at max random Base32 value", function () {
                expect(() => {
                    incrementBase32("Z".repeat(RANDOM_LEN));
                }).to.throw(/Cannot increment Base32 maximum value/);
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
            expect(this.ulid()).to.have.a.lengthOf(TIME_LEN + RANDOM_LEN);
        });

        describe("with timestamp", function () {
            it("should return expected encoded time component result", function () {
                expect(this.ulid(TEST_TIME_EPOCH_MS).substring(0, TIME_LEN)).to.equal(
                    TEST_TIME_ENCODED
                );
            });

            it("should always return the same value when time and randomness are frozen", function () {
                // both time seed and the random component are frozen for this test
                for (let x = 0; x < 10; x++) {
                    expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                        TEST_TIME_ENCODED + "0000000000000000"
                    );
                }
            });

            describe("should throw an error", function () {
                it("if validateTimestamp is being called", function () {
                    expect(() => {
                        encodeTime(Math.pow(2, 48));
                    }).to.throw(/cannot encode a timestamp larger than/);
                });
            });
        });

        describe("without timestamp", function () {
            before(function () {
                this.clock = sinon.useFakeTimers({
                    now: TEST_TIME_EPOCH_MS,
                    toFake: ["Date"],
                });
            });

            after(function () {
                this.clock.restore();
            });

            it("should always return the same value", function () {
                // both time and the random component are frozen for this test
                for (let x = 0; x < 10; x++) {
                    expect(this.ulid()).to.equal(TEST_TIME_ENCODED + "0000000000000000");
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
            expect(ulid()).to.have.a.lengthOf(TIME_LEN + RANDOM_LEN);
        });

        describe("with timestamp should never step backwards in lexical sort", function () {
            before(function () {
                this.ulid = ulidFactory({ monotonic: true });
            });

            it("first call", function () {
                expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000000"
                );
            });

            it("second call with older timestamp returns current timestamp and incremented random", function () {
                // the value of the ULIDs time component was not pushed backwards
                expect(this.ulid(TEST_TIME_EPOCH_MS - 1000)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000001"
                );
            });

            it("third call", function () {
                expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000002"
                );
            });

            it("fourth call with even older timestamp returns current timestamp and incremented random", function () {
                // the value of the ULIDs time component was not pushed backwards
                expect(this.ulid(TEST_TIME_EPOCH_MS - 86400)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000003"
                );
            });

            describe("should throw an error", function () {
                it("if validateTimestamp is being called", function () {
                    expect(() => {
                        encodeTime(Math.pow(2, 48));
                    }).to.throw(/cannot encode a timestamp larger than/);
                });
            });
        });

        describe("without timestamp", function () {
            before(function () {
                this.clock = sinon.useFakeTimers({
                    now: TEST_TIME_EPOCH_MS,
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
                expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000000"
                );
            });

            it("second call", function () {
                expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000001"
                );
            });

            it("third call", function () {
                expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000002"
                );
            });

            it("fourth call", function () {
                expect(this.ulid(TEST_TIME_EPOCH_MS)).to.equal(
                    TEST_TIME_ENCODED + "0000000000000003"
                );
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
