declare global {
  interface Window {
    Kakao: any;
  }
}

const KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;

function init() {
  const k = window.Kakao;
  if (!k || !KEY || k.isInitialized()) return;
  k.init(KEY);
}

export function shareRoom(roomId: string, title: string) {
  init();
  const k = window.Kakao;
  if (!k?.Share) return;

  const url = `${window.location.origin}${window.location.pathname}#/room/${roomId}`;
  k.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description: '링크 열고 바로 투표 · 로그인 없이 확인',
      imageUrl: 'https://lonysg.github.io/PickTime/og-card.png',
      imageWidth: 1200,
      imageHeight: 630,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '지금 참여하기', link: { mobileWebUrl: url, webUrl: url } }],
  });
}
