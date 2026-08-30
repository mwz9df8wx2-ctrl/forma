import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Power } from 'lucide-react'
import type { CatalogItem, CatalogType } from '@shared/index'
import { CATALOG_TYPE_LABELS } from '@shared/index'
import { createCatalogItem, disableCatalogItem, listCatalog } from '@/api/server/catalog'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'

/**
 * Каталог компании.
 *
 * Здесь мебельщик заводит то, что реально делает: фасады, столешницы, корпуса.
 * Экран параметров предлагает клиенту только эти позиции.
 */

const TABS: CatalogType[] = ['facade', 'countertop', 'carcass']

const FACADE_MATERIALS = [
  { value: 'enamel', label: 'Эмаль' },
  { value: 'mdf', label: 'МДФ' },
  { value: 'veneer', label: 'Шпон' },
  { value: 'solid_wood', label: 'Массив дерева' },
  { value: 'chipboard', label: 'ЛДСП' },
  { value: 'acrylic', label: 'Акрил' },
  { value: 'plastic', label: 'Пластик' },
]

const FINISHES = [
  { value: 'matte', label: 'Матовая' },
  { value: 'satin', label: 'Сатиновая' },
  { value: 'gloss', label: 'Глянцевая' },
  { value: 'wood', label: 'Древесная' },
  { value: 'stone', label: 'Каменная' },
  { value: 'textured', label: 'Текстурная' },
]

const COUNTERTOP_MATERIALS = [
  { value: 'quartz', label: 'Кварцевый агломерат' },
  { value: 'stone', label: 'Натуральный камень' },
  { value: 'porcelain', label: 'Керамогранит' },
  { value: 'hpl', label: 'HPL' },
  { value: 'wood', label: 'Дерево' },
  { value: 'chipboard', label: 'ЛДСП' },
]

export function CatalogPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { show, showError } = useToast()

  const [type, setType] = useState<CatalogType>('facade')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('#EAE4D8')
  const [material, setMaterial] = useState('enamel')
  const [finish, setFinish] = useState('matte')
  const [price, setPrice] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      setItems(await listCatalog(type, true))
    } catch (error) {
      showError(toAppError(error))
    } finally {
      setLoading(false)
    }
  }, [session, type, showError])

  useEffect(() => {
    void load()
  }, [load])

  if (!session) {
    return (
      <>
        <PageHeader showLogo title="Каталог" subtitle="Материалы вашей компании." />
        <div className="px-5 pt-7 pb-10 lg:px-10">
          <EmptyState
            icon={<Plus />}
            title="Каталог хранится на сервере компании"
            description="Войдите, чтобы завести реальные фасады, столешницы и корпусные материалы. До входа приложение работает на встроенном демонстрационном наборе."
            action={
              <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
                Войти
              </Button>
            }
          />
        </div>
      </>
    )
  }

  const resetForm = () => {
    setName('')
    setColorName('')
    setColorHex('#EAE4D8')
    setPrice('')
  }

  const submit = async () => {
    setSaving(true)
    try {
      const attributes =
        type === 'facade'
          ? {
              material,
              colorName: colorName || name,
              colorHex,
              finish,
              thicknessMm: 19,
              handleless: finish === 'matte',
            }
          : type === 'countertop'
            ? {
                material,
                decor: colorName || name,
                colorHex,
                actualThicknessMm: 20,
                visualThicknessMm: 38,
              }
            : { decor: colorName || name, material: 'chipboard', thicknessMm: 16 }

      await createCatalogItem({
        type,
        name,
        sku: '',
        purchasePrice: null,
        salePrice: price ? Number(price) : null,
        active: true,
        demo: false,
        attributes,
      })
      show({ title: 'Запись добавлена в каталог', variant: 'success' })
      setAdding(false)
      resetForm()
      await load()
    } catch (error) {
      showError(toAppError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        showLogo
        title="Каталог"
        subtitle={`${session.user.companyName} · то, что предлагается клиенту`}
        action={
          <div className="hidden lg:block">
            <Button
              variant="primary"
              size="md"
              icon={<Plus />}
              onClick={() => {
                setMaterial(type === 'countertop' ? 'quartz' : 'enamel')
                setAdding(true)
              }}
            >
              Добавить
            </Button>
          </div>
        }
      />

      <div className="px-5 pt-6 pb-10 lg:px-10">
        <div
          role="tablist"
          aria-label="Разделы каталога"
          className="inline-flex gap-1 rounded-lg bg-surface-3 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={type === tab}
              onClick={() => setType(tab)}
              className={cn(
                'min-h-10 rounded-md px-4 text-[0.875rem] font-medium transition-all duration-200',
                type === tab ? 'bg-surface text-ink shadow-hair' : 'text-muted hover:text-ink',
              )}
            >
              {CATALOG_TYPE_LABELS[tab]}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4 lg:hidden"
          icon={<Plus />}
          onClick={() => {
            setMaterial(type === 'countertop' ? 'quartz' : 'enamel')
            setAdding(true)
          }}
        >
          Добавить
        </Button>

        {loading && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <EmptyState
            className="mt-6"
            icon={<Plus />}
            title="Здесь пока пусто"
            description="Добавьте реальные материалы вашей компании — именно они будут предлагаться клиенту при подборе."
          />
        )}

        {!loading && items.length > 0 && (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const attributes = item.attributes as { colorHex?: string; colorName?: string; decor?: string }
              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-line bg-surface p-3',
                    !item.active && 'opacity-55',
                  )}
                >
                  <span
                    aria-hidden
                    className="size-12 shrink-0 rounded-lg border border-black/5"
                    style={{ backgroundColor: attributes.colorHex ?? '#E7E3DB' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] leading-snug font-medium text-ink">{item.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {attributes.colorName ?? attributes.decor ?? '—'}
                      {item.salePrice ? ` · ${item.salePrice} ₽` : ''}
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      {item.demo && <Badge tone="neutral">Демо</Badge>}
                      {!item.active && <Badge tone="neutral">Выключено</Badge>}
                    </div>
                  </div>
                  {item.active && (
                    <IconButton
                      label={`Выключить «${item.name}»`}
                      size="sm"
                      onClick={async () => {
                        await disableCatalogItem(item.id)
                        show({ title: 'Запись выключена', variant: 'success' })
                        await load()
                      }}
                    >
                      <Power className="size-4" />
                    </IconButton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={`Новая запись · ${CATALOG_TYPE_LABELS[type].toLowerCase()}`}
        description="Запись станет доступна при подборе материалов в проектах."
        footer={
          <>
            <Button variant="secondary" size="md" fullWidth onClick={() => setAdding(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={saving}
              disabled={name.trim().length < 2}
              onClick={() => void submit()}
            >
              Добавить
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-4">
          <Input
            label="Название"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={type === 'facade' ? 'Эмаль жемчужная матовая' : 'Кварц светлый камень'}
          />
          <Select
            label="Материал"
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            options={type === 'countertop' ? COUNTERTOP_MATERIALS : FACADE_MATERIALS}
          />
          {type === 'facade' && (
            <Select
              label="Отделка"
              value={finish}
              onChange={(event) => setFinish(event.target.value)}
              options={FINISHES}
            />
          )}
          <Input
            label={type === 'countertop' ? 'Декор' : 'Название цвета'}
            value={colorName}
            onChange={(event) => setColorName(event.target.value)}
            placeholder="Жемчужный"
          />
          <div>
            <label
              htmlFor="catalog-color"
              className="mb-1.5 block text-[0.8125rem] font-medium text-muted"
            >
              Цвет
            </label>
            <div className="flex items-center gap-3">
              <input
                id="catalog-color"
                type="color"
                value={colorHex}
                onChange={(event) => setColorHex(event.target.value)}
                className="h-12 w-16 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
              />
              <span className="font-mono text-[0.875rem] text-muted">{colorHex.toUpperCase()}</span>
            </div>
          </div>
          <Input
            label="Цена за м², ₽"
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            hint="Необязательно. Понадобится для сметы."
          />
        </div>
      </Modal>
    </>
  )
}
