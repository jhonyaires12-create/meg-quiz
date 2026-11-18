// ─────────────────────────────────────────────────────────────
//  PREGUNTAS DEL JUEGO
//  Edita libremente este archivo. Tipos disponibles:
//   - "choice": alternativas con UNA correcta (índice en `correct`, empieza en 0). Da puntos por rapidez.
//   - "poll":   encuesta, no hay correcta. Da puntos fijos por participar.
//   - "text":   respuesta libre escrita. Da puntos fijos por participar.
//  `seconds`: tiempo para responder.  `note`: se muestra al revelar la respuesta.
//  `quote`: texto grande opcional (por ejemplo, el versículo).
// ─────────────────────────────────────────────────────────────

module.exports = [
  {
    type: 'choice',
    category: 'Para calentar',
    prompt: '¿Dónde se puede evangelizar?',
    options: ['En la calle', 'En la universidad o el cole', 'En redes sociales', 'En todas partes'],
    correct: 3,
    seconds: 20,
    note: '«Id por todo el mundo y predicad el evangelio a toda criatura» (Marcos 16:15).',
  },
  {
    type: 'choice',
    category: 'Romper el hielo',
    prompt: 'Quieres hablarle de Jesús a un desconocido. ¿Cómo rompes el hielo?',
    options: [
      '«¿Tienes wifi? Porque siento una conexión…»',
      'Gritarle «¡ARREPIÉNTETE!» desde lejos',
      'Una pregunta sincera: «¿Qué te da esperanza?»',
      'Mirarlo fijo 5 minutos sin decir nada',
    ],
    correct: 2,
    seconds: 20,
    note: 'Escuchar primero y luego pedir permiso para compartir. ¡El wifi no salva!',
  },
  {
    type: 'choice',
    category: 'Los pasos',
    prompt: '¿Cuál es un buen orden para una conversación evangelística?',
    options: [
      'Hablar sin parar → dar el folleto → salir corriendo',
      'Escuchar → preguntar → compartir a Jesús → invitar a responder',
      'Discutir de religión → ganar el debate → despedirse',
      'Pedir su número → nunca escribirle',
    ],
    correct: 1,
    seconds: 25,
    note: 'No buscamos ganar una discusión; buscamos comunicar a Cristo con respeto.',
  },
  {
    type: 'poll',
    category: 'Encuesta',
    prompt: '¿Qué es lo que MÁS distrae hoy a los jóvenes?',
    options: ['TikTok y Reels', 'Videojuegos', 'Series y streaming', 'El «qué dirán»'],
    seconds: 20,
    note: 'Si sabemos dónde está su atención, sabemos por dónde empezar la conversación.',
  },
  {
    type: 'choice',
    category: 'Dato real',
    prompt: 'En promedio, ¿cuántas horas al día pasa un adolescente en redes sociales?',
    options: ['1 hora', '3 horas', 'Casi 5 horas', '10 horas'],
    correct: 2,
    seconds: 20,
    note: 'World Happiness Report 2026 (EE. UU.): casi 5 horas diarias. En América Latina, ~1 de cada 4 adolescentes usa redes 5 horas o más.',
  },
  {
    type: 'choice',
    category: '¿Dónde está el versículo?',
    prompt: '¿Dónde se encuentra este versículo?',
    quote: '«Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito…»',
    options: ['Juan 3:15', 'Juan 3:16', 'Juan 3:17'],
    correct: 1,
    seconds: 20,
  },
  {
    type: 'choice',
    category: '¿Dónde está el versículo?',
    prompt: '¿Dónde se encuentra este versículo?',
    quote: '«Por cuanto todos pecaron, y están destituidos de la gloria de Dios.»',
    options: ['Romanos 3:22', 'Romanos 3:23', 'Romanos 3:26'],
    correct: 1,
    seconds: 20,
  },
  {
    type: 'choice',
    category: '¿Dónde está el versículo?',
    prompt: '¿Dónde se encuentra este versículo?',
    quote: '«Porque la paga del pecado es muerte, mas la dádiva de Dios es vida eterna…»',
    options: ['Romanos 3:23', 'Romanos 5:8', 'Romanos 6:23'],
    correct: 2,
    seconds: 20,
  },
  {
    type: 'choice',
    category: '¿Dónde está el versículo?',
    prompt: '¿Dónde se encuentra este versículo?',
    quote: '«Si confesamos nuestros pecados, él es fiel y justo para perdonar nuestros pecados…»',
    options: ['Juan 1:9', '1 Juan 1:9', '1 Juan 1:7'],
    correct: 1,
    seconds: 20,
  },
  {
    type: 'choice',
    category: '¿Dónde está el versículo?',
    prompt: '¿Dónde se encuentra este versículo?',
    quote: '«Mas a todos los que le recibieron, a los que creen en su nombre, les dio potestad de ser hechos hijos de Dios.»',
    options: ['Juan 1:11', 'Juan 1:12', 'Juan 1:14'],
    correct: 1,
    seconds: 20,
  },
  {
    type: 'choice',
    category: '¿Dónde está el versículo?',
    prompt: '¿Dónde se encuentra este versículo?',
    quote: '«Porque por gracia sois salvos por medio de la fe… no por obras, para que nadie se gloríe.»',
    options: ['Efesios 2:5', 'Efesios 2:8-9', 'Efesios 2:10'],
    correct: 1,
    seconds: 20,
  },
  {
    type: 'text',
    category: 'Escribe tu respuesta',
    prompt: '¿Qué versículos nos mandan a evangelizar? Escribe los que recuerdes.',
    seconds: 60,
    note: 'Algunos: Mateo 28:19-20 · Marcos 16:15 · Hechos 1:8 · 2 Corintios 5:20 · Romanos 10:14-15',
  },
];
