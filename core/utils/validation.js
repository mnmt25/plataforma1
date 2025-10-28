export class ValidationError extends Error {
  constructor(field, rule, detail) {
    super('VALIDATION_ERROR');
    this.status = 400;
    this.payload = {
      code: 'VALIDATION_ERROR',
      field,
      rule,
      detail
    };
  }
}

export function requireOneOf(values, fields) {
  if (!fields.some((field) => {
    const v = values[field];
    return typeof v === 'string' && v.trim().length > 0;
  })) {
    throw new ValidationError(fields.join('|'), 'required_any', 'Debe indicar al menos uno de los campos obligatorios.');
  }
}

export function ensureLength(value, field, { min = 0, max = Infinity }) {
  if (value == null) {
    if (min > 0) {
      throw new ValidationError(field, 'required', 'Campo obligatorio.');
    }
    return;
  }
  const length = value.trim().length;
  if (length < min || length > max) {
    throw new ValidationError(field, 'length', `Longitud permitida ${min}-${max}.`);
  }
}

export function ensurePattern(value, field, pattern, detail) {
  if (value == null) {
    return;
  }
  if (!pattern.test(value)) {
    throw new ValidationError(field, 'format', detail);
  }
}

export function ensureBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new ValidationError(field, 'boolean', 'Debe ser booleano.');
  }
}

export function ensureEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new ValidationError(field, 'enum', 'Valor no permitido.');
  }
}

export function normalizeLike(value) {
  return value ? value.trim().toLowerCase() : null;
}
