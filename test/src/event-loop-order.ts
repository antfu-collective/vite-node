const order: string[] = []

Promise.resolve().then(() => order.push('P'))
queueMicrotask(() => order.push('Q'))
process.nextTick(() => order.push('N'))
setImmediate(() => order.push('I'))
setTimeout(() => order.push('T'), 0)
order.push('S')

setTimeout(() => {
  // eslint-disable-next-line no-console
  console.log(order.join(''))
}, 100)
