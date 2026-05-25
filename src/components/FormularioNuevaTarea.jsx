import { useState } from 'react'
import dayjs from 'dayjs'
import { Card, CardBody, CardHeader, Input, Button, Alert, Divider } from '@heroui/react'
import useMediaQuery from '@mui/material/useMediaQuery'
import { DatePicker, DesktopTimePicker, MobileTimePicker } from '@mui/x-date-pickers'
import { PlusSquare, ChevronDown, ChevronUp } from 'lucide-react'

const VALORES_INICIALES = {
  wo: '',
  id_atm: '',
  nombre: '',
  direccion: '',
  distrito: '',
  fecha: '',
  hora: '',
  ce: '',
  modelo: '',
  serie: '',
}

function normalizarHora(valor) {
  if (!valor) return ''

  if (dayjs.isDayjs(valor) && valor.isValid()) {
    return valor.format('HH:mm')
  }

  const texto = String(valor).trim()
  if (!texto) return ''

  const match = texto.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return texto

  const [, horas, minutos] = match
  return `${horas.padStart(2, '0')}:${minutos}`
}

function convertirHoraADayjs(valor) {
  const hora = normalizarHora(valor)
  if (!hora) return null

  const [horas, minutos] = hora.split(':').map(Number)
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null

  return dayjs().hour(horas).minute(minutos).second(0).millisecond(0)
}

function convertirFechaADayjs(valor) {
  if (!valor) return null
  const fecha = dayjs(valor, 'YYYY-MM-DD', true)
  return fecha.isValid() ? fecha : null
}

function pickerTextFieldSx(esHora = false) {
  return {
    '& .MuiPickersTextField-root': {
      width: '100%',
    },
    '& .MuiFormLabel-root': {
      color: 'rgb(113, 113, 122)',
      fontSize: '0.875rem',
      fontWeight: 500,
    },
    '& .MuiFormLabel-root.Mui-focused': {
      color: 'rgb(59, 130, 246)',
    },
    '& .MuiPickersOutlinedInput-root, & .MuiOutlinedInput-root': {
      minHeight: '56px',
      borderRadius: '0.875rem',
      background: 'rgba(255,255,255,0.98)',
      overflow: 'hidden',
      transition: 'box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
      '& .MuiPickersOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline, & fieldset': {
        borderColor: 'rgb(212, 212, 216)',
        borderWidth: '1px',
      },
      '&:hover .MuiPickersOutlinedInput-notchedOutline, &:hover .MuiOutlinedInput-notchedOutline, &:hover fieldset': {
        borderColor: 'rgb(161, 161, 170)',
      },
      '&.Mui-focused .MuiPickersOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline, &.Mui-focused fieldset': {
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: '1px',
      },
      '&.Mui-focused': {
        boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.12)',
      },
      '&.Mui-error .MuiPickersOutlinedInput-notchedOutline, &.Mui-error .MuiOutlinedInput-notchedOutline, &.Mui-error fieldset': {
        borderColor: 'rgb(239, 68, 68)',
      },
      '&.Mui-error.Mui-focused': {
        boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.12)',
      },
    },
    '& .MuiPickersSectionList-root': {
      minHeight: '56px',
      alignItems: 'center',
    },
    '& .MuiPickersInputBase-sectionsContainer': {
      paddingTop: '16.5px',
      paddingBottom: '16.5px',
    },
    '& .MuiInputBase-input': {
      color: 'rgb(39, 39, 42)',
      fontSize: '0.95rem',
      ...(esHora ? {
        cursor: 'pointer',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontWeight: 700,
        letterSpacing: '0.08em',
        fontVariantNumeric: 'tabular-nums',
      } : {
        fontWeight: 500,
      }),
    },
    '& .MuiFormHelperText-root': {
      marginLeft: '0.25rem',
      marginRight: '0.25rem',
      marginTop: '0.375rem',
    },
    '& .MuiInputAdornment-root .MuiButtonBase-root': {
      color: 'rgb(59, 130, 246)',
      borderRadius: '0.75rem',
    },
    '& .MuiPickersInputAdornment-root .MuiButtonBase-root': {
      color: 'rgb(59, 130, 246)',
      borderRadius: '0.75rem',
    },
  }
}

function CampoFechaMUI({ value, onChange, errorMessage }) {
  return (
    <DatePicker
      label="Fecha"
      value={convertirFechaADayjs(value)}
      onChange={(nuevoValor) => onChange(nuevoValor?.isValid() ? nuevoValor.format('YYYY-MM-DD') : '')}
      format="DD/MM/YYYY"
      slotProps={{
        textField: {
          fullWidth: true,
          size: 'small',
          error: Boolean(errorMessage),
          helperText: errorMessage,
          placeholder: 'dd/mm/aaaa',
          variant: 'outlined',
          sx: pickerTextFieldSx(false),
        },
        field: {
          clearable: true,
        },
      }}
    />
  )
}

function CampoHoraMUI({ value, onChange, errorMessage }) {
  const esDesktop = useMediaQuery('(pointer: fine)')
  const PickerComponent = esDesktop ? DesktopTimePicker : MobileTimePicker
  const [abierto, setAbierto] = useState(false)

  return (
    <PickerComponent
      label="Hora"
      value={convertirHoraADayjs(value)}
      onChange={(nuevoValor) => onChange(normalizarHora(nuevoValor))}
      open={abierto}
      onOpen={() => setAbierto(true)}
      onClose={() => setAbierto(false)}
      ampm={false}
      format="HH:mm"
      openTo="hours"
      views={['hours', 'minutes']}
      closeOnSelect={esDesktop}
      slotProps={{
        field: {
          clearable: true,
          onClear: () => onChange(''),
          readOnly: true,
        },
        textField: {
          fullWidth: true,
          size: 'small',
          error: Boolean(errorMessage),
          helperText: errorMessage,
          placeholder: '00:00',
          variant: 'outlined',
          onClick: () => setAbierto(true),
          sx: pickerTextFieldSx(true),
        },
        desktopPaper: {
          sx: {
            mt: 1,
            borderRadius: '20px',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            boxShadow: '0 24px 54px rgba(15, 23, 42, 0.18)',
          },
        },
        mobilePaper: {
          sx: {
            borderRadius: '24px',
          },
        },
        actionBar: {
          actions: ['clear', 'cancel', 'accept'],
        },
      }}
    />
  )
}

export default function FormularioNuevaTarea({ onCrearTarea, cargando = false }) {
  const [formulario, setFormulario] = useState(VALORES_INICIALES)
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [expandido, setExpandido] = useState(false)

  function actualizarCampo(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }))
    if (errores[campo]) {
      setErrores(prev => ({ ...prev, [campo]: undefined }))
    }
  }

  function validar() {
    const nuevosErrores = {}

    if (!formulario.wo.trim()) nuevosErrores.wo = 'La WO es obligatoria.'
    if (!formulario.id_atm.trim()) nuevosErrores.id_atm = 'El ID ATM es obligatorio.'
    if (!formulario.nombre.trim()) nuevosErrores.nombre = 'La agencia es obligatoria.'
    if (!formulario.direccion.trim()) nuevosErrores.direccion = 'La dirección es obligatoria.'
    if (!formulario.distrito.trim()) nuevosErrores.distrito = 'El distrito es obligatorio.'
    if (!formulario.fecha.trim()) nuevosErrores.fecha = 'La fecha es obligatoria.'
    if (!formulario.hora.trim()) nuevosErrores.hora = 'La hora es obligatoria.'

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function enviarFormulario() {
    setMensaje(null)
    if (!validar()) return

    try {
      await onCrearTarea?.({
        wo: formulario.wo.trim(),
        id_atm: formulario.id_atm.trim(),
        nombre: formulario.nombre.trim(),
        direccion: formulario.direccion.trim(),
        distrito: formulario.distrito.trim(),
        fecha: formulario.fecha.trim(),
        hora: formulario.hora.trim(),
        ce: formulario.ce.trim(),
        modelo: formulario.modelo.trim(),
        serie: formulario.serie.trim(),
      })

      setFormulario(VALORES_INICIALES)
      setMensaje({
        color: 'success',
        title: 'Tarea creada',
        description: 'La tarea se guardó correctamente.',
      })
    } catch (error) {
      setMensaje({
        color: 'danger',
        title: 'No se pudo crear la tarea',
        description: error.message || 'Ocurrió un error inesperado.',
      })
    }
  }

  return (
    <Card shadow="sm">
      <button
        type="button"
        className="w-full text-left py-3"
         onClick={() => setExpandido(prev => !prev)}
      >
        <CardHeader className="flex gap-3 py-0">
          <PlusSquare size={18} className="text-default-400" />
          <p className="text-sm font-semibold">Agregar tarea manual</p>
          <span className="ml-auto text-default-400">
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </CardHeader>
      </button>
      {expandido && (
        <>
      <Divider className="mt-3" />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Serie"
            value={formulario.serie}
            onValueChange={value => actualizarCampo('serie', value)}
            variant="bordered"
            radius="lg"
          />
          <Input
            label="Modelo"
            value={formulario.modelo}
            onValueChange={value => actualizarCampo('modelo', value)}
            variant="bordered"
            radius="lg"
          />
          <Input
            label="ID ATM"
            value={formulario.id_atm}
            onValueChange={value => actualizarCampo('id_atm', value)}
            isInvalid={Boolean(errores.id_atm)}
            errorMessage={errores.id_atm}
            variant="bordered"
            radius="lg"
          />
          <Input
            label="Agencia"
            value={formulario.nombre}
            onValueChange={value => actualizarCampo('nombre', value)}
            isInvalid={Boolean(errores.nombre)}
            errorMessage={errores.nombre}
            variant="bordered"
            radius="lg"
          />
          <Input
            className="md:col-span-2"
            label="Dirección"
            value={formulario.direccion}
            onValueChange={value => actualizarCampo('direccion', value)}
            isInvalid={Boolean(errores.direccion)}
            errorMessage={errores.direccion}
            variant="bordered"
            radius="lg"
          />
          <Input
            label="Distrito"
            value={formulario.distrito}
            onValueChange={value => actualizarCampo('distrito', value)}
            isInvalid={Boolean(errores.distrito)}
            errorMessage={errores.distrito}
            variant="bordered"
            radius="lg"
          />
          <CampoFechaMUI
            value={formulario.fecha}
            onChange={value => actualizarCampo('fecha', value)}
            errorMessage={errores.fecha}
          />
          <CampoHoraMUI
            value={formulario.hora}
            onChange={value => actualizarCampo('hora', value)}
            errorMessage={errores.hora}
          />
          <Input
            label="CE"
            value={formulario.ce}
            onValueChange={value => actualizarCampo('ce', value)}
            variant="bordered"
            radius="lg"
          />
          <Input
            label="WO"
            value={formulario.wo}
            onValueChange={value => actualizarCampo('wo', value)}
            isInvalid={Boolean(errores.wo)}
            errorMessage={errores.wo}
            variant="bordered"
            radius="lg"
          />
        </div>

        <div className="flex justify-end">
          <Button color="primary" radius="lg" onPress={enviarFormulario} isLoading={cargando}>
            Crear tarea
          </Button>
        </div>

        {mensaje && (
          <Alert
            color={mensaje.color}
            title={mensaje.title}
            description={mensaje.description}
          />
        )}
      </CardBody>
        </>
      )}
    </Card>
  )
}
