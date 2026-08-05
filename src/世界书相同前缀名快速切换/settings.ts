const Settings = z
  .object({
    whitelist: z.array(z.string()).default([]),
    ballSize: z.number().default(48),
    ballOpacity: z.number().default(0.8),
    customIcon: z.string().nullable().default(null),
    ballPosition: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .nullable()
      .default(null),
  })
  .prefault({});

export type SettingsType = z.infer<typeof Settings>;

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsType>(
    Settings.parse(getVariables({ type: 'script', script_id: getScriptId() })),
  );

  watchEffect(() => {
    insertOrAssignVariables(klona(settings.value), { type: 'script', script_id: getScriptId() });
  });

  return { settings };
});