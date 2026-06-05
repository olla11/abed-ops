export default function AppFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
      <span className="font-medium text-gray-500">ABED-ONG</span>
      {' · '}Agriculture pour le Bien-Être et le Développement Durable
      {' · '}© {year}
      {' · '}
      <a
        href="mailto:contact@abedong.org"
        className="hover:text-green-600 transition-colors"
      >
        contact@abedong.org
      </a>
      {' · '}
      <span>+229 0167779141</span>
    </footer>
  )
}
