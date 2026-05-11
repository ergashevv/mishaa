import type { DeepPartial } from '../deep-merge';
import { en } from '../en';

/** Japanese UI strings — part 1 (merged over `en`). */
export const jaPart1: DeepPartial<typeof en> = {
  common: { appLoading: '読み込み中…' },
  nav: {
    gallery: 'ギャラリー',
    about: '概要',
    support: 'サポート',
    guides: 'ガイド',
    readingHub: '読書ハブ',
    terminal: 'コミックスタジオ',
    registry: '登録',
    library: 'ライブラリ',
  },
  hero: {
    title: 'マンガ＆マンファ ライブラリ',
    pageH1: 'マンガ・成人向け・マンファ・ウェブトゥーン — ブラウザで読む',
    featuredSeries: 'おすすめ',
    readFeaturedCta: '読む',
    desc:
      '英語・ロシア語だけではなく、日本語・韓国語・中国語のタイトル検索（原文・ローマ字）。MangaDex形式のメタデータ。全画面チャプター、ブックマーク、アプリ不要。年齢確認後は成人向け棚。UIは日英韓中露。当サイトは MangaDex.org とは無関係の独立ブラウザリーダーです。',
    cta: 'ライブラリを見る',
    launch: 'すべて見る',
    issue: '号',
    standard: '公式版',
    quickSearchPlaceholder: 'タイトル検索（日・韓・中・英・露 / ローマ字・MangaDex）… 2文字以上',
    quickSearchResults: '一致',
    quickSearchSearching: '検索中…',
    quickSearchNone: 'まだ一致なし',
    quickSearchHint: '短時間キャッシュ — 連打でAPIを攻めません。',
    viewAllInLibrary: 'ライブラリのすべての結果',
    shelfNoMatchesTitle: '見つかりません',
    shelfNoMatchesBody: 'ホームのフィードに一致するものがありません。',
  },
  features: {
    title: 'シネマティックな読書。',
    quote: 'コマ向けに調整したタイポとコントラスト — すっきり、シャープな見開き。',
    forge: 'ライブラリアーカイブ',
    forgeDesc: 'どの章でも一貫した体験。',
    inking: 'ビジュアル品質',
    inkingDesc: '高コントラストと深い黒。',
    grid: 'スマートレイアウト',
    gridDesc: 'あらゆる端末で最適なコマ配置。',
    blueprint: 'コレクション',
    sequence: 'ストーリー',
    reliability: '純粋な品質。',
    reliabilityDesc: 'スマホもデスクトップも同じリーダー。',
    uplink: '接続',
  },
};
