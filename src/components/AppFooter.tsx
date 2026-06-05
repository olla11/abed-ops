export default function AppFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-6 flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-semibold text-green-700 tracking-wide uppercase">
          ABED-ONG
        </p>
        <p className="text-xs text-gray-500 max-w-lg leading-relaxed">
          Agriculture pour le Bien-Être et le Développement Durable
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400 mt-1">
          <a
            href="mailto:contact@abedong.org"
            className="hover:text-green-600 transition-colors"
          >
            contact@abedong.org
          </a>
          <span className="text-gray-300">·</span>
          <span>+229 0167779141</span>
          <span className="text-gray-300">·</span>
          <span>© {year}</span>
        </div>
      </div>
    </footer>
  )
}
