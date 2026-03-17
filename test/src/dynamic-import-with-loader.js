async function loadModule() {
  const module = await import('./example.data')
  // eslint-disable-next-line no-console
  console.log('Import succeeded from', module.id)
}

loadModule()
