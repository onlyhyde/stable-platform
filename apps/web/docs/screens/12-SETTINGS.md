# 12. Settings

**Source**: `app/settings/page.tsx`
**Route**: `/settings`

## UI 구성

### Tab Navigation (4개)
| 탭 | 아이콘 | 컴포넌트 |
|----|------|----------|
| Network | 🌐 | NetworkSettingsCard |
| Account | 👤 | AccountSettingsCard |
| Security | 🛡️ | SecuritySettingsCard + SocialRecoveryCard |
| Developer | 🔧 | DeveloperSettingsCard |

### 각 탭 카드
- **Network**: 체인 전환 (`switchChain`)
- **Account**: 연결 상태, disconnect
- **Security**: 보안 설정 + 소셜 복구 모듈
- **Developer**: 개발자 도구

## 데이터 흐름

```
Hooks:
  - useWallet() → address, isConnected
  - useAccount() → chain
  - useDisconnect() → disconnect()
  - useSwitchChain() → switchChain(), isPending

State:
  - activeTab: 'network' | 'account' | 'security' | 'developer'
```

## Issue Checklist

- [ ] `switchChain?.()` optional chaining — undefined일 때 조용히 실패. 에러 toast 필요
- [ ] `useSwitchChain().isPending` 미사용 — 체인 전환 중 버튼 비활성화 안됨
- [ ] `disconnect()` 후 페이지 이동/안내 없음 — Settings에 머물며 혼동
- [ ] `defaultChain` undefined 가능성 — fallback chain 미설정 시 에러
