"use client"

import { useEffect } from "react"
import { Crisp } from "crisp-sdk-web"

export const CrispChat = () => {
    useEffect(() => {
        Crisp.configure("3b3108d0-34ff-4805-9c49-da3882de94fe")
    }, [])

    return null
}