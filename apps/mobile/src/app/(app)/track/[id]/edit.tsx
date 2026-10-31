import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { getTrack, updateTrack } from '@tracknow/core/services/tracksService'
import { TRACK_COLORS, TRACK_ICONS } from '@tracknow/core/constants/trackTemplates'
import { AppBar } from '@/components/AppBar'
import { TrackIcon } from '@/components/tracks/TrackIcon'
import { Button, Card, LoadingState, Screen, Text, TextField } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, resolveTrackColor, spacing } from '@/theme/tokens'

export default function EditTrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useTheme()
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Activity')
  const [color, setColor] = useState('#c8f169')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (typeof id !== 'string') return
    getTrack(id)
      .then((track) => {
        if (track) {
          setName(track.name)
          setDescription(track.description ?? '')
          setIcon(track.icon)
          setColor(track.color)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [id])

  const save = async () => {
    if (busyRef.current || typeof id !== 'string') return
    if (!name.trim()) {
      setError('Track name is required.')
      return
    }
    if (name.trim().length > 80) {
      setError('Track name must be 80 characters or fewer.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await updateTrack(id, { name: name.trim(), description: description.trim() || null, icon, color })
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save track')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Screen scroll={false}>
        <AppBar title="Edit track" />
        <LoadingState />
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar title="Edit track" />
      <View style={{ gap: spacing[4] }}>
        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <TrackIcon icon={icon} color={color} size={52} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            Update the name, description, color and icon.
          </Text>
        </View>

        <TextField label="Name" value={name} onChangeText={setName} maxLength={80} />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <View style={{ gap: spacing[2] }}>
          <Text variant="caption" weight="medium">
            Color
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {TRACK_COLORS.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setColor(c.value)}
                accessibilityLabel={c.label}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.pill,
                  backgroundColor: c.value,
                  borderWidth: 3,
                  borderColor: color === c.value ? colors.focusRing : 'transparent',
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
          <Text variant="caption" weight="medium">
            Icon
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {TRACK_ICONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => setIcon(ic)}
                style={{
                  padding: 3,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: icon === ic ? resolveTrackColor(color) : 'transparent',
                }}
              >
                <TrackIcon icon={ic} color={color} size={40} />
              </Pressable>
            ))}
          </View>
        </View>

        <Button title={busy ? 'Saving…' : 'Save changes'} block loading={busy} onPress={save} />
      </View>
    </Screen>
  )
}
