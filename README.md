# ulid-workers

A zero-dependency `ULID` generator for [Cloudflare Workers](https://developers.cloudflare.com/workers/) that is written entirely in Typescript and generates `ULID`s monotonically by default. It is **not** compatible with Node.js.

This library was forked [ulidx](https://github.com/perry-mitchell/ulidx), which in turn was based on the original [ulid](https://github.com/ulid/javascript) library that targeted Node.js and the browser.

## About

### What is a ULID?

ULIDs are universally Unique Lexicographically sortable IDentifiers. This library adheres to [the ULID specification](https://github.com/ulid/spec).

### Monotonicity and ULID Time in Cloudflare Workers

This library breaks slightly from tradition in that it generates `monotonic` `ULID`s by default. Normally `ULID`s are lexically sortable because the time component of the `ULID` is based on a high precision timestamp that is always moving forward. It is this timestamp that allows the `ULID` to be easily sorted in those cases.

However, in the context of a Cloudflare Worker this assumption of always incrementing time breaks down a little. The Workers team has chosen, for security reasons, to freeze time within the context of a single worker request/response cycle.

The [Workers documentation](https://developers.cloudflare.com/workers/learning/security-model#step-1-disallow-timers-and-multi-threading) talks about the security reasons for this at length.

> In Workers, you can get the current time using the JavaScript Date API, for example by calling `Date.now()`. However, the time value returned by this is not really the current time. Instead, it is the **time at which the network message was received** which caused the application to begin executing. While the application executes, time is locked in place.

So if you were to generate multiple `ULID`s in a single request they would all have the same exact time component. In this case the normal behavior of other `ULID` libraries would be to have the random component be truly random. This means that if you generated 10 `ULID`s within a single request they would no longer be able to be guaranteed to be lexically sortable. Thus you lose one of the most important properties of the `ULID`.

The `ULID` spec defines a method for handling this situation. You can generate a [`monotonic`](https://github.com/ulid/spec#monotonicity) `ULID` which allows for the creation of more than `2^80` `ULID`s within a single millisecond while ensuring that they remain sortable. It does this by incrementing the random component by 1 bit in the least significant bit position (with carrying). Therefore the random component remains sortable even when the timestamp components are identical.

So for example, if you generated five new ULID's within the same `ms` of a time-frozen request you would see something like:

```text
00004WT65H0000000000000000
00004WT65H0000000000000001
00004WT65H0000000000000002
00004WT65H0000000000000003
00004WT65H0000000000000004
```

You can see that the time component remains at `00004WT65H` while the random component that follows has its least significant bit incremented by `1`.

It is for these reasons we use the [monotonic ULID factory](#monotonic-ulid-factory) by default. Of course you can also use the `non-monotonic` version just as easily.

For more on the decision to fork, please also see [this discussion](https://github.com/perry-mitchell/ulidx/pull/6#issuecomment-1003190116).

### Are there any issues with using the `monotonic` generator?

Generally speaking, no.

However, if your use case:

* generates multiple `ULID`s in the context of a single request
* AND places high importance on the non-guessability of the next `ULID` in a sequence

Then you might want to use the `non-monotonic` configuration, sacrificing sortability. As you can see from the example above, it is trivial to guess what the next `ULID` in a sequence of `ULID`s all generated within a single `ms` are going to be.

We think for most use-cases for use within Cloudflare Workers these concerns are of lesser importance so we've chosen to use `monotonic` by default.

## Installation

Install using npm by running:

```shell
npm install ulid-workers --save
```

## Usage

Import a factory function from `ulid-workers` that is used to generate new `ULID`s.

You can select from a `monotonic` (the default) or `non-monotonic` factory.

### Monotonic

```typescript
import { ulidFactory } from "ulid-workers";
const ulid = ulidFactory();

const id = ulid();
// 01ARYZ6S41TSV4RRFFQ69G5FAV
```

### Non-Monotonic

```typescript
import { ulidFactory } from "ulid-workers";
const ulid = ulidFactory({ monotonic: false });

const id = ulid();
// 01ARYZ6S41TSV4RRFFQ69G5FAV
```

### Timestamp

By default, the `ulid()` function call will use the current timestamp for the time component of newly generated ULIDs. You can also provide a `timestamp` argument which will consistently give you the same string for the time component (the first 10 characters) of the `ULID`.

Providing a timestamp value can be useful, for example, for migrating from another timestamp based ID system to `ULID` where you want to retain the same timestamp component.

```typescript
ulid(1469918176385);
```

### Decode ULID Timestamp

Import the `decodeTime` function to extract the timestamp component embedded in a `ULID`:

```typescript
import { decodeTime } from "ulid-workers";

decodeTime("01ARYZ6S41TSV4RRFFQ69G5FAV");
// 1469918176385
```

## Pseudo-Random Number Generation (PRNG)

The Cloudflare Workers runtime implements the [Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto) `crypto.getRandomValues()` function which this library uses to generate the random portion of a `ULID`.

## Compatibility

`ulid-workers` is compatible with Cloudflare Workers and Durable Objects. It is not compatible with Node.js since it does not implement `crypto.getRandomValues()`.
