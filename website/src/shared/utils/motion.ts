/**
 * Framer-motion re-export shim.
 *
 * Re-exports `m` as `motion` so every component in the codebase can keep using
 * `motion.div`, `motion.span`, etc. without change, while the app-level
 * `LazyMotion` wrapper (in WrapperLayouts) ensures animation features are
 * loaded asynchronously — cutting the framer-motion initial-bundle cost.
 *
 * `domMax` features are loaded by WrapperLayouts; this covers all DOM
 * animations including `Reorder` layout animations.
 */
export {
  AnimatePresence,
  MotionConfig,
  m as motion,
  Reorder,
  useInView,
  useScroll,
  useSpring,
} from 'framer-motion';
