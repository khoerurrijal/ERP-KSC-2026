export const DEFAULT_AI_MODEL = 'gemini-3.8-flash'
const FLASH_MODEL_FALLBACKS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite'
]

const isSupportedGeminiModel = (model) => {
  const value = String(model || '').replace(/^models\//, '')
  return /^gemini-[0-9]+(?:\.[0-9]+)*-flash(?:-[a-z0-9-]+)?$/i.test(value)
}

export async function getConfiguredAiModel(supabase) {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_agent_config')
      .single()
    const model = String(data?.value?.model || '').replace(/^models\//, '')
    return isSupportedGeminiModel(model) ? model : DEFAULT_AI_MODEL
  } catch {
    return DEFAULT_AI_MODEL
  }
}

export function chooseLatestAiModel(models = []) {
  const available = models
    .map(model => String(model?.name || '').replace(/^models\//, ''))
    .filter(isSupportedGeminiModel)

  const preferred = [
    DEFAULT_AI_MODEL,
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite'
  ]
  return preferred.find(model => available.includes(model)) || available[0] || DEFAULT_AI_MODEL
}

export function getAiModelCandidates(primaryModel = DEFAULT_AI_MODEL) {
  const primary = String(primaryModel || DEFAULT_AI_MODEL).replace(/^models\//, '')
  const primaryIndex = FLASH_MODEL_FALLBACKS.indexOf(primary)
  const fallbackModels = primaryIndex >= 0
    ? FLASH_MODEL_FALLBACKS.slice(primaryIndex + 1)
    : FLASH_MODEL_FALLBACKS
  return [primary, ...fallbackModels.filter(model => model !== primary)]
}

export function isRetryableAiError(error) {
  const status = Number(error?.status || error?.response?.status || 0)
  return status === 404 || status === 408 || status === 429 || status >= 500
}

export { isSupportedGeminiModel }
