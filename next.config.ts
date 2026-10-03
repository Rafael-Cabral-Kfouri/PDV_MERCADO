/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Uploads de produtos (Next 16 exige localPatterns; search vazio = sem query string)
    localPatterns: [
      {
        pathname: "/uploads/produtos/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
