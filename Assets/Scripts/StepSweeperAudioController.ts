const REVEAL = requireAsset("../GeneratedSFX/StepReveal.wav") as AudioTrackAsset
const FLAG = requireAsset("../GeneratedSFX/FlagToggle.wav") as AudioTrackAsset
const MINE = requireAsset("../GeneratedSFX/MineHit.wav") as AudioTrackAsset
const WIN = requireAsset("../GeneratedSFX/RoomCleared.wav") as AudioTrackAsset
const MUSIC = requireAsset("../GeneratedSFX/BackgroundMusic.wav") as AudioTrackAsset

/** Centralized LowLatency gameplay cues and LowPower looping music. */
export class StepSweeperAudioController {
  private readonly musicVolume = 0.12
  private reveal: AudioComponent
  private flag: AudioComponent
  private mine: AudioComponent
  private win: AudioComponent
  private music: AudioComponent
  private startAccent: AudioComponent | null = null
  private musicMuted = false
  private roundOver = false
  private revealObject: SceneObject
  private mineObject: SceneObject

  constructor(root: SceneObject, startAccentTrack?: AudioTrackAsset) {
    this.revealObject = this.audioObject(root, "RevealAudio")
    this.reveal = this.audio(this.revealObject, REVEAL, 0.32, Audio.PlaybackMode.LowLatency, true)
    this.flag = this.audio(this.audioObject(root, "FlagAudio"), FLAG, 0.42, Audio.PlaybackMode.LowLatency)
    this.mineObject = this.audioObject(root, "MineAudio")
    // A failure confirmation must remain audible when the player is looking
    // away, standing above the source, or outside spatial attenuation range.
    this.mine = this.audio(this.mineObject, MINE, 0.55, Audio.PlaybackMode.LowLatency)
    this.win = this.audio(this.audioObject(root, "WinAudio"), WIN, 0.45, Audio.PlaybackMode.LowLatency)
    this.music = this.audio(this.audioObject(root, "MusicAudio"), MUSIC, this.musicVolume, Audio.PlaybackMode.LowPower)
    if (startAccentTrack) {
      this.startAccent = this.audio(this.audioObject(root, "StartAccentAudio"), startAccentTrack, 0.28, Audio.PlaybackMode.LowLatency)
    }
    this.music.play(-1)
  }

  playReveal(worldPosition?: vec3): void {
    if (worldPosition) this.revealObject.getTransform().setWorldPosition(worldPosition)
    this.reveal.play(1)
  }
  playFlag(): void { this.flag.play(1) }
  playMine(worldPosition?: vec3): void {
    if (worldPosition) this.mineObject.getTransform().setWorldPosition(worldPosition)
    this.reveal.stop(false)
    this.roundOver = true
    this.updateMusicVolume()
    this.mine.play(1)
  }
  playWin(): void { this.win.play(1) }
  playStart(): void {
    this.mine.stop(false)
    this.roundOver = false
    this.updateMusicVolume()
    this.startAccent?.play(1)
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted
    this.updateMusicVolume()
  }

  private updateMusicVolume(): void {
    this.music.volume = this.musicMuted ? 0 : this.musicVolume * (this.roundOver ? 0.18 : 1)
  }

  private audio(parent: SceneObject, track: AudioTrackAsset, volume: number, mode: Audio.PlaybackMode, spatial = false): AudioComponent {
    const component = parent.createComponent("Component.AudioComponent") as AudioComponent
    component.audioTrack = track
    component.volume = volume
    component.playbackMode = mode
    component.spatialAudio.enabled = spatial
    component.spatialAudio.positionEffect.enabled = spatial
    component.spatialAudio.distanceEffect.enabled = spatial
    component.spatialAudio.distanceEffect.minDistance = 25
    component.spatialAudio.distanceEffect.maxDistance = 500
    return component
  }

  private audioObject(parent: SceneObject, name: string): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    return object
  }
}
